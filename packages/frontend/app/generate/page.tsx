"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    state: "safely_paused" | "all_batches_received";
    receivedBatchNumbers: number[];
    missingBatchNumbers: number[];
    nextBatchNumber: number | null;
    continuationPrompt: string | null;
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

function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(result);
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
  const [busy, setBusy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [preparationStage, setPreparationStage] = useState("");
  const automaticSyncStarted = useRef(false);

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

  const remoteSync = useCallback(async () => {
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
        { fetchedCommit: firstResult.fetchedCommit },
      );
      const processed = processResponse.data?.processed || [];
      const verified = processResponse.data?.cleanupEligible || [];
      const blockedByAccount = processResponse.data?.blockedByAccount || [];
      const failures = processResponse.data?.failures || [];
      const skippedItems = processResponse.data?.skippedItems || [];
      const staged = processResponse.data?.staged;
      const outcome = processResponse.data?.outcome;
      const discoveredDocuments =
        staged?.documents ?? firstResult.result?.documents ?? 0;
      if (blockedByAccount.length > 0) {
        throw new Error(
          `The fetched import ${blockedByAccount.join(", ")} is claimed by a different local account. Sign in with the account that originally claimed it; account ownership cannot be reassigned automatically.`,
        );
      }
      if (outcome === "retry_pending") {
        throw new Error(
          `Automatic import recovery will retry without intervention: ${failures
            .map(
              (failure: { manifestId?: string; message?: string }) =>
                `${failure.manifestId || "unknown manifest"}: ${failure.message || "reconciliation failed"}`,
            )
            .join("; ")}`,
        );
      }
      if (outcome === "no_eligible_manifest") {
        throw new Error(
          `Fetched ${discoveredDocuments} content-pack file(s) and staged them in the authenticated backend, but no eligible manifest remained. Staging reconciliation: ${staged?.manifestsAdded || 0} manifest(s) added, ${staged?.batchesAdded || 0} batch(es) added, ${staged?.unchanged || 0} unchanged. Refresh the import ledger for its exact ownership or completion state.`,
        );
      }
      const cleanupParams = new URLSearchParams();
      for (const manifestId of verified) {
        cleanupParams.append("manifestId", manifestId);
      }
      const cleanup =
        verified.length > 0
          ? await fetch(
              `/__control/cleanup-content?${cleanupParams.toString()}`,
              {
                method: "POST",
                headers: { "x-english-mastery-control": "1" },
              },
            ).then(async (response) => {
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(body.error || "Inbox cleanup failed.");
              }
              return body;
            })
          : { cleaned: [], alreadyAbsent: [], failed: [] };
      if (cleanup.failed?.length) {
        throw new Error(
          `The import passed PostgreSQL verification, but inbox cleanup failed: ${cleanup.failed
            .map(
              (item: { manifestId?: string; error?: string }) =>
                `${item.manifestId || "unknown manifest"}: ${item.error || "cleanup failed"}`,
            )
            .join("; ")}`,
        );
      }
      setMessage(
        skippedItems.length > 0
          ? `Imported and PostgreSQL-verified ${verified.length} pack(s). Skipped ${skippedItems.length} problematic item(s) after processing all valid batches: ${skippedItems
              .map(
                (item: { term?: string; reason?: string }) =>
                  `${item.term || "unknown term"} — ${item.reason || "could not be imported safely"}`,
              )
              .join("; ")}`
          : cleanup.cleaned?.length
            ? `Imported and PostgreSQL-verified ${verified.length} pack(s); removed ${cleanup.cleaned.length} completed pack(s) from the inbox.`
            : cleanup.alreadyAbsent?.length
              ? "Synchronized; the verified pack was already absent and is now recorded as cleaned."
              : processed.length > 0
                ? `Processed ${processed.length} pack(s); ${verified.length} passed PostgreSQL read-back verification. Check any remaining import attention below.`
                : discoveredDocuments === 0
                  ? "No ChatGPT content-pack files were found in the inbox."
                  : "Content-pack files were synchronized, but no new import required processing.",
      );
      await load();
    } catch (syncError: any) {
      setError(
        syncError?.response?.data?.message ||
          (syncError instanceof Error
            ? syncError.message
            : "Content sync failed."),
      );
    } finally {
      setBusy("");
    }
  }, [load]);

  useEffect(() => {
    if (isLoading || automaticSyncStarted.current) return;
    automaticSyncStarted.current = true;
    void remoteSync();
  }, [isLoading, remoteSync]);

  const loadDetail = async (id: string) => {
    const response = await getApiClient().get(
      `/api/control/content-packs/${id}`,
    );
    const manifest = response.data.manifest as PackManifest;
    setDetails((current) => ({ ...current, [id]: manifest }));
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

  const copyContinuation = async (manifest: PackManifest) => {
    const prompt = manifest.generation.continuationPrompt;
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage(
        `Continuation request copied. Paste it into ChatGPT to resume ${manifest.id} from batch ${manifest.generation.nextBatchNumber}.`,
      );
    } catch {
      setError(`Copy this continuation request: ${prompt}`);
    }
  };

  const downloadPreparedRequest = (request: any) => {
    const blob = new Blob([JSON.stringify(request, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${request.requestId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const waitForSourceRequest = async (jobId: string) => {
    for (;;) {
      const response = await getApiClient().get(
        `/api/control/source-requests/${jobId}`,
      );
      const job = response.data.job;
      setPreparationStage(job.stage);
      if (job.status === "completed") return job.request;
      if (job.status === "failed") {
        throw new Error(
          job.error || "Source preparation failed. You can retry the same source.",
        );
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
  };

  const prepareSourceRequest = async () => {
    if (!sourceFile && !sourceText.trim()) {
      setError("Paste source text or choose a supported file.");
      return;
    }
    setBusy("prepare-source");
    setPreparationStage("uploading");
    setMessage("");
    setError("");
    try {
      const sourceName = sourceFile?.name || "pasted-text.txt";
      const bytes = sourceFile
        ? new Uint8Array(await sourceFile.arrayBuffer())
        : new TextEncoder().encode(sourceText);
      const response = await getApiClient().post(
        "/api/control/source-requests",
        {
          sourceName,
          contentBase64: bytesToBase64(bytes),
        },
      );
      const request = await waitForSourceRequest(response.data.job.id);
      downloadPreparedRequest(request);
      setMessage(
        `Prepared ${request.reconciliation.readableWords.toLocaleString()} words in ${request.reconciliation.processingChunks} bounded chunk(s), with zero untracked words. Attach the downloaded ${request.requestId}.json file in ChatGPT and write Generate.`,
      );
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          requestError.message ||
          "The source could not be prepared.",
      );
    } finally {
      setBusy("");
      setPreparationStage("");
    }
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title="ChatGPT Imports"
        description="Upload or paste the source here first. The backend prepares a complete deterministic assessment request; ChatGPT then creates validated lessons and sends them through your private GitHub inbox."
        actions={
          <button
            type="button"
            onClick={remoteSync}
            disabled={busy === "sync"}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy === "sync" ? "Checking…" : "Check imports now"}
          </button>
        }
      >
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Prepare a source for ChatGPT
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Upload here first. The backend creates the exact inventory, bounded
            chunks, taxonomy snapshot and existing-vocabulary matches that
            ChatGPT needs for a complete v5 content pack.
          </p>
          <textarea
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              if (event.target.value) setSourceFile(null);
            }}
            placeholder="Paste an article, chapter, or other text here…"
            className="mt-4 min-h-40 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".txt,.md,.html,.htm,.vtt,.pdf,.srt,.docx,.epub"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setSourceFile(file);
                if (file) setSourceText("");
              }}
              className="text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={() => void prepareSourceRequest()}
              disabled={busy === "prepare-source"}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {busy === "prepare-source"
                ? `Preparing… ${preparationStage || "starting"}`
                : "Prepare for ChatGPT"}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Maximum source size: 25 MB. Large sources continue in a durable background job, so the browser request timeout cannot cancel preparation. The downloaded request is immutable and contains no database credentials.
          </p>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            No API key or separate API billing
          </h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-4">
            {[
              [
                "1",
                "Share source",
                "Upload or paste TXT, MD, PDF, DOCX, EPUB, HTML, SRT or VTT in this app.",
              ],
              [
                "2",
                "Assess automatically",
                "Attach the downloaded assessment request in ChatGPT and write Generate.",
              ],
              [
                "3",
                "Import automatically",
                "The signed-in app assigns ownership, imports, verifies and cleans up automatically.",
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
                  For your practical test, prepare a small source above, attach the downloaded request in ChatGPT, and write Generate.
                </p>
              </div>
            ) : (
              manifests.map((manifest) => {
                const detail = details[manifest.id];
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
                      {manifest.generation.state === "safely_paused" && (
                        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
                          <p className="font-medium">
                            Safely paused — no candidates or completed batches
                            were lost.
                          </p>
                          <p className="mt-1 text-xs">
                            Received:{" "}
                            {manifest.generation.receivedBatchNumbers.join(
                              ", ",
                            ) || "none"}{" "}
                            · Missing:{" "}
                            {manifest.generation.missingBatchNumbers.join(", ")}{" "}
                            · Next: {manifest.generation.nextBatchNumber}
                          </p>
                        </div>
                      )}
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
                      {manifest.generation.continuationPrompt && (
                        <button
                          onClick={() => void copyContinuation(manifest)}
                          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                          Copy recovery prompt
                        </button>
                      )}
                      {!detail && (
                        <button
                          onClick={() => loadDetail(manifest.id)}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          View candidate audit
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
    </AuthenticatedPage>
  );
}
