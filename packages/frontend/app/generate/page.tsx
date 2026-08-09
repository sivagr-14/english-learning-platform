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
  ambiguousSenses: number;
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
  inboxCleanedAt?: string | null;
  inboxCleanupCommit?: string | null;
  inboxBranch?: string | null;
  fetchedCommit?: string | null;
  lastSyncedAt?: string | null;
  syncStatus?: string | null;
  syncError?: string | null;
  lastVerifiedAt?: string | null;
  verification?: { verified?: boolean; entries?: number; issues?: string[] };
  cleanupAttempts?: number;
  cleanupError?: string | null;
  nextAction?: string;
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
  sense_decision?: "same_sense" | "new_sense" | "ambiguous";
  sense_key?: string;
  decision_reason?: string;
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
  const [confirmApprove, setConfirmApprove] = useState<{
    id: string;
    count: number;
  } | null>(null);

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
      const firstResponse = await fetch("/__control/sync-content", {
        method: "POST",
        headers: { "x-english-mastery-control": "1" },
      });
      const firstResult = await firstResponse.json().catch(() => ({}));
      if (!firstResponse.ok)
        throw new Error(
          firstResult.technicalDetail
            ? `${firstResult.error || "Content sync failed."} ${firstResult.technicalDetail}`
            : firstResult.error || "Content sync failed.",
        );
      const processResponse = await getApiClient().post(
        "/api/control/content-packs/process",
      );
      const processed = processResponse.data?.processed || [];
      const verified = processResponse.data?.cleanupEligible || [];
      const blockedByAccount = processResponse.data?.blockedByAccount || [];
      const discoveredDocuments = firstResult.result?.documents || 0;
      if (blockedByAccount.length > 0) {
        throw new Error(
          `The fetched import ${blockedByAccount.join(", ")} is claimed by a different local account. Sign in with the account that originally claimed it; account ownership cannot be reassigned automatically.`,
        );
      }
      if (discoveredDocuments > 0 && processed.length === 0) {
        throw new Error(
          "Content-pack files were fetched, but no import was claimed or resumed.",
        );
      }
      // Processing can make newly claimed packs cleanup-eligible. A second
      // guarded sync removes them in the same one-click workflow.
      const cleanupResponse = await fetch("/__control/sync-content", {
        method: "POST",
        headers: { "x-english-mastery-control": "1" },
      });
      const result = await cleanupResponse.json().catch(() => ({}));
      if (!cleanupResponse.ok)
        throw new Error(result.error || "Inbox cleanup failed.");
      setMessage(
        result.cleanup?.cleaned?.length
          ? `Imported and PostgreSQL-verified ${verified.length} pack(s); removed ${result.cleanup.cleaned.length} completed pack(s) from the inbox.`
          : result.cleanup?.alreadyAbsent?.length
            ? "Synchronized; the verified pack was already absent and is now recorded as cleaned."
            : processed.length > 0
              ? `Processed ${processed.length} pack(s); ${verified.length} passed PostgreSQL read-back verification. Check any remaining import attention below.`
              : discoveredDocuments === 0
                ? "No ChatGPT content-pack files were found in the inbox."
                : "Content-pack files were synchronized, but no new import required processing.",
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
      setMessage(
        "Import claimed. All eligible high- and medium-frequency entries were scheduled automatically.",
      );
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
    setConfirmApprove({ id, count: candidateIds.length });
  };

  const doApprove = async (id: string) => {
    setConfirmApprove(null);
    const candidateIds = [...(selected[id] || new Set<string>())];
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
                "Assess automatically",
                "ChatGPT accounts for every page, chunk and term.",
              ],
              [
                "3",
                "Sync once",
                "The app claims and processes eligible terms automatically.",
              ],
              [
                "4",
                "Ready to learn",
                "Lessons are saved, verified and removed from the active import ledger.",
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
                const senseAttention = (detail?.candidates || []).filter(
                  (candidate) => candidate.status === "manual_review",
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
                          "Sense attention",
                          manifest.counts.ambiguousSenses || 0,
                        ],
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

                    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-950">
                        Exact next action
                      </p>
                      <p className="mt-1">
                        {manifest.nextAction ||
                          "Refresh this import to load its recovery state."}
                      </p>
                      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-slate-500">Inbox branch</dt>
                          <dd className="font-mono">
                            {manifest.inboxBranch || "chatgpt-content-inbox"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Fetched commit</dt>
                          <dd className="font-mono">
                            {manifest.fetchedCommit?.slice(0, 12) ||
                              "Not recorded"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">
                            Database verification
                          </dt>
                          <dd>
                            {manifest.verification?.verified
                              ? "Passed"
                              : "Pending or failed"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Inbox cleanup</dt>
                          <dd>
                            {manifest.inboxCleanedAt
                              ? "Recorded"
                              : `Pending (${manifest.cleanupAttempts || 0} attempts)`}
                          </dd>
                        </div>
                      </dl>
                      {(manifest.syncError ||
                        manifest.cleanupError ||
                        manifest.verification?.issues?.length) && (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-red-700">
                          {manifest.syncError && <li>{manifest.syncError}</li>}
                          {manifest.cleanupError && (
                            <li>{manifest.cleanupError}</li>
                          )}
                          {(manifest.verification?.issues || []).map(
                            (issue) => (
                              <li key={issue}>{issue}</li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {!manifest.claimed && (
                        <button
                          onClick={() => claim(manifest.id)}
                          disabled={busy === `claim:${manifest.id}`}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {busy === `claim:${manifest.id}`
                            ? "Claiming…"
                            : "Claim and start"}
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
                          Revalidate PostgreSQL records
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
                    {detail && senseAttention.length > 0 && (
                      <div className="mt-6 border-t border-amber-200 pt-5">
                        <h4 className="font-semibold text-amber-950">
                          Contextual meanings requiring attention
                        </h4>
                        <div className="mt-3 space-y-3">
                          {senseAttention.map((candidate) => (
                            <div
                              key={candidate.id}
                              className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                            >
                              <p className="font-medium text-amber-950">
                                {candidate.item}
                              </p>
                              <p className="mt-1 text-sm text-amber-900">
                                {candidate.contextual_meaning}
                              </p>
                              <p className="mt-1 text-xs text-amber-800">
                                {candidate.decision_reason ||
                                  candidate.filter_reason ||
                                  "The contextual sense could not be resolved safely."}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </AppShell>

      {/* Inline confirmation modal replacing window.confirm (B7) */}
      {confirmApprove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2
              id="confirm-title"
              className="text-base font-semibold text-slate-900"
            >
              Confirm approval
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Approve exactly <strong>{confirmApprove.count}</strong>{" "}
              {confirmApprove.count === 1 ? "entry" : "entries"}? Validated
              batches will save automatically after this.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmApprove(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doApprove(confirmApprove.id)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Approve {confirmApprove.count}{" "}
                {confirmApprove.count === 1 ? "entry" : "entries"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedPage>
  );
}
