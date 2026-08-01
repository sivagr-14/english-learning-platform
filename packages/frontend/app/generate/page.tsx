"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

interface PackCounts {
  candidatesIdentified: number;
  alreadyPresentUnchanged: number;
  existingEntriesToUpdate: number;
  lowValueFilteredOut: number;
  newEntriesProposed: number;
  totalEntriesToProcess: number;
  heavyUseSelections: number;
  mediumUseSelections: number;
  totalPages: number;
  assessedPages: number;
  unreadablePages: number;
  totalChunks: number;
  assessedChunks: number;
  unreadableChunks: number;
  plannedBatches: number;
}

interface PackManifest {
  id: string;
  sourceName: string;
  sourceType: string;
  status: string;
  claimed: boolean;
  counts: PackCounts;
  generation: {
    plannedBatches: number;
    receivedBatches: number;
    missingBatches: number;
    invalidBatches: number;
    committedEntries: number;
  };
  candidates?: PackCandidate[];
  createdAt: string;
}

interface PackCandidate {
  id: string;
  external_candidate_id: string;
  item: string;
  item_type: string;
  cefr_level: string;
  usage_frequency: string;
  action: string;
  status: string;
  contextual_meaning: string;
  filter_reason?: string;
}

interface IngestError {
  document_path: string;
  pack_id?: string;
  issues: string[] | string;
  updated_at: string;
}

function statusTone(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (["attention_required", "invalid", "conflict"].includes(status)) {
    return "bg-red-100 text-red-800";
  }
  if (["processing", "approved"].includes(status)) {
    return "bg-blue-100 text-blue-800";
  }
  return "bg-amber-100 text-amber-800";
}

function readIssues(value: IngestError["issues"]): string[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [value];
  }
}

export default function ChatGPTImportsPage() {
  const [manifests, setManifests] = useState<PackManifest[]>([]);
  const [ingestErrors, setIngestErrors] = useState<IngestError[]>([]);
  const [details, setDetails] = useState<Record<string, PackManifest>>({});
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await getApiClient().get("/api/control/content-packs");
      setManifests(response.data.manifests);
      setIngestErrors(response.data.ingestErrors || []);
    } catch {
      setError(
        "ChatGPT imports could not be loaded. Check the backend and retry.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remoteSync = async () => {
    setBusy("sync");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/__control/sync-content", {
        method: "POST",
        headers: { "x-english-mastery-control": "1" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Content sync failed.");
      setMessage(
        result.available === false
          ? "The ChatGPT content inbox has not been initialized yet."
          : "ChatGPT content inbox synchronized and validated.",
      );
      await load();
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Content sync failed.",
      );
    } finally {
      setBusy("");
    }
  };

  const loadDetail = async (id: string) => {
    const response = await getApiClient().get(
      `/api/control/content-packs/${id}`,
    );
    const manifest = response.data.manifest as PackManifest;
    setDetails((current) => ({ ...current, [id]: manifest }));
    const proposed = (manifest.candidates || [])
      .filter((candidate) => candidate.status === "proposed")
      .map((candidate) => candidate.external_candidate_id);
    setSelected((current) => ({ ...current, [id]: new Set(proposed) }));
  };

  const claim = async (id: string) => {
    setBusy(`claim:${id}`);
    setError("");
    try {
      await getApiClient().post(`/api/control/content-packs/${id}/claim`);
      setMessage("Import claimed. Review the exact terms before approval.");
      await Promise.all([load(), loadDetail(id)]);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "The import could not be claimed.",
      );
    } finally {
      setBusy("");
    }
  };

  const approve = async (id: string) => {
    const candidateIds = [...(selected[id] || new Set<string>())];
    if (!candidateIds.length) {
      setError("Select at least one proposed entry before approval.");
      return;
    }
    if (!window.confirm(`Approve exactly ${candidateIds.length} entries?`))
      return;
    setBusy(`approve:${id}`);
    setError("");
    try {
      await getApiClient().post(`/api/control/content-packs/${id}/approve`, {
        candidateIds,
      });
      setMessage(
        "Selection approved. Validated ChatGPT batches will now save automatically.",
      );
      await Promise.all([load(), loadDetail(id)]);
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "Approval failed.",
      );
    } finally {
      setBusy("");
    }
  };

  const verify = async (id: string) => {
    setBusy(`verify:${id}`);
    setError("");
    try {
      const response = await getApiClient().post(
        `/api/control/content-packs/${id}/verify`,
      );
      if (!response.data.verified) {
        throw new Error(response.data.issues.join("; "));
      }
      setMessage(
        `${response.data.entries} entries verified in words, lessons, progress and review tables.`,
      );
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError.message ||
          "Verification failed.",
      );
    } finally {
      setBusy("");
    }
  };

  const toggle = (manifestId: string, candidateId: string) => {
    setSelected((current) => {
      const next = new Set(current[manifestId] || []);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return { ...current, [manifestId]: next };
    });
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title="ChatGPT Imports"
        description="ChatGPT assesses your PDF or text, creates complete lessons, and sends validated content packs through your private GitHub inbox. Only this local backend writes to PostgreSQL."
        actions={
          <button
            type="button"
            onClick={remoteSync}
            disabled={busy === "sync"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy === "sync" ? "Synchronizing…" : "Sync ChatGPT content"}
          </button>
        }
      >
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            No API key or separate API billing
          </h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-4">
            {[
              ["1", "Share source", "Paste text or attach the PDF in ChatGPT."],
              [
                "2",
                "Review assessment",
                "ChatGPT accounts for pages, chunks and terms.",
              ],
              [
                "3",
                "Approve exact terms",
                "Claim the manifest here and select the entries.",
              ],
              [
                "4",
                "Sync lessons",
                "Validated batches save locally and are read back.",
              ],
            ].map(([number, title, detail]) => (
              <li key={number} className="rounded-lg bg-white/80 p-4">
                <span className="text-xs font-bold text-blue-700">
                  STEP {number}
                </span>
                <p className="mt-1 font-semibold text-slate-950">{title}</p>
                <p className="mt-1 leading-5 text-slate-600">{detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs font-medium text-blue-800">
            Transport: private GitHub branch · Storage: local PostgreSQL ·
            Automatic check: every 5 minutes
          </p>
        </section>

        {message && (
          <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {ingestErrors.length > 0 && (
          <section className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-semibold text-red-950">
              Content packs requiring correction
            </h2>
            <ul className="mt-3 space-y-3 text-sm text-red-800">
              {ingestErrors.map((item) => {
                const issues = readIssues(item.issues);
                return (
                  <li key={`${item.document_path}:${item.updated_at}`}>
                    <span className="font-medium">{item.document_path}</span>
                    <span className="mt-1 block">{issues.join("; ")}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Import ledger
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                An import remains incomplete while any planned batch is missing
                or invalid.
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {manifests.length} imports
            </span>
          </div>

          <div className="mt-4 space-y-5">
            {isLoading ? (
              <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">
                Loading…
              </div>
            ) : manifests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <h3 className="font-semibold text-slate-950">
                  No ChatGPT imports yet
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  For your practical test, paste a small text in ChatGPT and ask
                  it to assess and prepare the import.
                </p>
              </div>
            ) : (
              manifests.map((manifest) => {
                const detail = details[manifest.id];
                const proposed = (detail?.candidates || []).filter(
                  (candidate) => candidate.status === "proposed",
                );
                return (
                  <article
                    key={manifest.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-950">
                          {manifest.sourceName}
                        </h3>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {manifest.sourceType} · {manifest.id}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(manifest.status)}`}
                      >
                        {manifest.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
                      {[
                        [
                          "Pages",
                          `${manifest.counts.assessedPages}/${manifest.counts.totalPages}`,
                        ],
                        [
                          "Chunks",
                          `${manifest.counts.assessedChunks}/${manifest.counts.totalChunks}`,
                        ],
                        ["Candidates", manifest.counts.candidatesIdentified],
                        ["To generate", manifest.counts.totalEntriesToProcess],
                        ["Filtered", manifest.counts.lowValueFilteredOut],
                        [
                          "Batches",
                          `${manifest.generation.receivedBatches}/${manifest.generation.plannedBatches}`,
                        ],
                        ["Saved", manifest.generation.committedEntries],
                        ["Missing", manifest.generation.missingBatches],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="mt-1 text-lg font-semibold text-slate-950">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {!manifest.claimed && (
                        <button
                          onClick={() => claim(manifest.id)}
                          disabled={busy === `claim:${manifest.id}`}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {busy === `claim:${manifest.id}`
                            ? "Claiming…"
                            : "Claim and review"}
                        </button>
                      )}
                      {manifest.claimed && !detail && (
                        <button
                          onClick={() => loadDetail(manifest.id)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Review candidates
                        </button>
                      )}
                      {manifest.status === "completed" && (
                        <button
                          onClick={() => verify(manifest.id)}
                          disabled={busy === `verify:${manifest.id}`}
                          className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-60"
                        >
                          Verify PostgreSQL records
                        </button>
                      )}
                    </div>

                    {detail &&
                      proposed.length > 0 &&
                      manifest.status === "awaiting_approval" && (
                        <div className="mt-6 border-t border-slate-200 pt-5">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-semibold text-slate-950">
                              Select exact entries
                            </h4>
                            <span className="text-sm text-slate-600">
                              {selected[manifest.id]?.size || 0} selected
                            </span>
                          </div>
                          <div className="mt-3 max-h-80 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
                            {proposed.map((candidate) => (
                              <label
                                key={candidate.id}
                                className="flex cursor-pointer gap-3 p-3 hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    selected[manifest.id]?.has(
                                      candidate.external_candidate_id,
                                    ) || false
                                  }
                                  onChange={() =>
                                    toggle(
                                      manifest.id,
                                      candidate.external_candidate_id,
                                    )
                                  }
                                  className="mt-1"
                                />
                                <span>
                                  <span className="font-medium text-slate-950">
                                    {candidate.item}
                                  </span>
                                  <span className="ml-2 text-xs uppercase text-slate-500">
                                    {candidate.cefr_level} ·{" "}
                                    {candidate.usage_frequency}
                                  </span>
                                  <span className="mt-1 block text-sm text-slate-600">
                                    {candidate.contextual_meaning}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                          <button
                            onClick={() => approve(manifest.id)}
                            disabled={busy === `approve:${manifest.id}`}
                            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {busy === `approve:${manifest.id}`
                              ? "Approving…"
                              : `Approve ${selected[manifest.id]?.size || 0} entries`}
                          </button>
                        </div>
                      )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </AppShell>
    </AuthenticatedPage>
  );
}
