"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

// ─── Types ──────────────────────────────────────────────────────────────────

type SourceType = "text" | "pdf" | "srt" | "docx" | "epub";

type JobStatus =
  | "queued"
  | "extracting"
  | "assessing"
  | "generating"
  | "validating"
  | "committed"
  | "failed";

interface StageProgress {
  chunksTotal?: number;
  chunksProcessed?: number;
  candidatesFound?: number;
  lessonsGenerated?: number;
  lessonsFailedValidation?: number;
  lessonsTotal?: number;
  lessonsCommitted?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostUsd?: number;
}

interface GenerationJob {
  id: string;
  source_name: string;
  source_type: SourceType;
  status: JobStatus;
  stage_progress: StageProgress;
  actual_cost?: number;
  tokens_used?: number;
  error_message?: string | null;
  created_at: string;
}

interface CostEstimate {
  candidateCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  model: string;
}

interface AiConfig {
  primaryConfigured: boolean;
  primaryModel: string;
  primaryProvider: string;
  escalationConfigured: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIPELINE_STAGES: { status: JobStatus; label: string; detail: (p: StageProgress) => string }[] = [
  {
    status: "extracting",
    label: "Reading document",
    detail: () => "Parsing and cleaning source text",
  },
  {
    status: "assessing",
    label: "Identifying vocabulary",
    detail: (p) =>
      p.chunksTotal
        ? `Analysing ${p.chunksTotal} chunk${p.chunksTotal !== 1 ? "s" : ""}${p.candidatesFound !== undefined ? ` · ${p.candidatesFound} candidates found` : ""}`
        : "Finding useful words and phrases",
  },
  {
    status: "generating",
    label: "Writing lessons",
    detail: (p) =>
      p.lessonsTotal
        ? `${p.lessonsGenerated ?? 0} / ${p.lessonsTotal} lessons written${p.lessonsFailedValidation ? ` · ${p.lessonsFailedValidation} skipped` : ""}`
        : "Building full vocabulary lessons",
  },
  {
    status: "validating",
    label: "Verifying quality",
    detail: () => "Running quality checks on all lessons",
  },
  {
    status: "committed",
    label: "Saved to vocabulary",
    detail: (p) =>
      p.lessonsCommitted !== undefined
        ? `${p.lessonsCommitted} word${p.lessonsCommitted !== 1 ? "s" : ""} added`
        : "Complete",
  },
];

const STAGE_ORDER: JobStatus[] = [
  "queued",
  "extracting",
  "assessing",
  "generating",
  "validating",
  "committed",
];

const EXTENSION_TO_TYPE: Record<string, SourceType> = {
  txt: "text",
  md: "text",
  pdf: "pdf",
  srt: "srt",
  docx: "docx",
  epub: "epub",
};

function stageIndex(status: JobStatus) {
  const i = STAGE_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AiConfigBanner({ config }: { config: AiConfig | null }) {
  if (!config || config.primaryConfigured) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <strong>AI key not configured.</strong> Add{" "}
      <code className="rounded bg-amber-100 px-1 font-mono text-xs">PRIMARY_AI_API_KEY</code>{" "}
      (or <code className="rounded bg-amber-100 px-1 font-mono text-xs">GEMINI_API_KEY</code>) to{" "}
      <code className="rounded bg-amber-100 px-1 font-mono text-xs">.env.local</code> and restart the
      server. Jobs will fail until this is set.
    </div>
  );
}

function CostEstimateCard({
  estimate,
  onDismiss,
}: {
  estimate: CostEstimate;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Estimated cost</h3>
          <p className="mt-1 text-sm text-slate-600">
            {estimate.candidateCount} vocabulary candidates identified. Generation will begin
            automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mt-0.5 text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Candidates", value: estimate.candidateCount.toString() },
          {
            label: "Input tokens",
            value: estimate.estimatedInputTokens.toLocaleString(),
          },
          {
            label: "Output tokens",
            value: estimate.estimatedOutputTokens.toLocaleString(),
          },
          {
            label: "Est. cost (USD)",
            value:
              estimate.estimatedCostUsd < 0.01
                ? `< $0.01`
                : `$${estimate.estimatedCostUsd.toFixed(3)}`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-white p-3">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 text-lg font-bold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-blue-700">
        Model: <strong>{estimate.model}</strong> · Estimates based on published Gemini pricing.
        Actual cost may vary.
      </p>
    </div>
  );
}

function PipelineProgress({
  job,
  costEstimate,
  onDismissCost,
}: {
  job: GenerationJob;
  costEstimate: CostEstimate | null;
  onDismissCost: () => void;
}) {
  const activeIndex = stageIndex(job.status === "failed" ? "queued" : job.status);
  const progress = job.stage_progress || {};
  const isTerminal = job.status === "committed" || job.status === "failed";

  const pct =
    job.status === "generating" && progress.lessonsTotal
      ? Math.round(((progress.lessonsGenerated ?? 0) / progress.lessonsTotal) * 100)
      : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 truncate max-w-xs">{job.source_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Started {new Date(job.created_at).toLocaleTimeString()}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            job.status === "committed"
              ? "bg-emerald-100 text-emerald-700"
              : job.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {job.status === "committed"
            ? "Complete"
            : job.status === "failed"
              ? "Failed"
              : "Running"}
        </span>
      </div>

      {/* Stage steps */}
      <ol className="mt-5 flex flex-col gap-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = i < activeIndex || job.status === "committed";
          const active =
            job.status !== "committed" &&
            job.status !== "failed" &&
            stage.status === job.status;
          const pending = !done && !active;

          return (
            <li key={stage.status} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${done ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white animate-pulse" : "bg-slate-200 text-slate-500"}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${done ? "text-emerald-700" : active ? "text-blue-700" : "text-slate-400"}`}
                >
                  {stage.label}
                </p>
                {active && (
                  <p className="text-xs text-slate-500">{stage.detail(progress)}</p>
                )}
                {done && i === PIPELINE_STAGES.length - 1 && (
                  <p className="text-xs text-emerald-600">{stage.detail(progress)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Generating progress bar */}
      {pct !== null && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Writing lessons</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Cost estimate card (shown after assess completes) */}
      {costEstimate && !isTerminal && (
        <div className="mt-4">
          <CostEstimateCard estimate={costEstimate} onDismiss={onDismissCost} />
        </div>
      )}

      {/* Final summary */}
      {job.status === "committed" && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          <strong>{progress.lessonsCommitted ?? 0} words</strong> added to your vocabulary.
          {job.actual_cost != null && Number(job.actual_cost) > 0 && (
            <span className="ml-2 text-emerald-600">
              · ${Number(job.actual_cost).toFixed(4)} actual cost
              {job.tokens_used ? ` · ${job.tokens_used.toLocaleString()} tokens` : ""}
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {job.status === "failed" && job.error_message && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {job.error_message}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { token } = useAuthStore();

  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);

  // Per-job SSE state: costEstimate keyed by jobId, dismissed keyed by jobId
  const [costEstimates, setCostEstimates] = useState<Record<string, CostEstimate>>({});
  const [dismissedCosts, setDismissedCosts] = useState<Set<string>>(new Set());

  // Per-job SSE abort controllers (fetch-based SSE supports Authorization header)
  const sseRefs = useRef<Record<string, AbortController>>({});
  // Fallback poll interval
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

  // ── Load AI config once ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    getApiClient()
      .get("/api/generation/config-check")
      .then((r) => setAiConfig(r.data))
      .catch(() => setAiConfig(null));
  }, []);

  // ── Load jobs list ──────────────────────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const { data } = await getApiClient().get("/api/generation/jobs");
      setJobs(data.jobs);
    } catch {
      // Non-fatal — skip tick
    }
  }, []);

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadJobs]);

  // ── Open SSE (fetch-based, supports Authorization) for each active job ───
  useEffect(() => {
    if (!token) return;

    jobs.forEach((job) => {
      const isTerminal = job.status === "committed" || job.status === "failed";
      if (isTerminal || sseRefs.current[job.id]) return;

      const controller = new AbortController();
      sseRefs.current[job.id] = controller;

      (async () => {
        try {
          const response = await fetch(
            `${API_BASE}/api/generation/jobs/${job.id}/progress`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          if (!response.ok || !response.body) return;

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("event: done")) {
                controller.abort();
                delete sseRefs.current[job.id];
                void loadJobs();
                return;
              }
              if (!line.startsWith("data: ")) continue;
              try {
                const update = JSON.parse(line.slice(6)) as {
                  status: JobStatus;
                  stageProgress: StageProgress;
                  actualCost?: number;
                  tokensUsed?: number;
                };
                setJobs((prev) =>
                  prev.map((j) =>
                    j.id === job.id
                      ? {
                          ...j,
                          status: update.status,
                          stage_progress: update.stageProgress ?? j.stage_progress,
                          actual_cost: update.actualCost ?? j.actual_cost,
                          tokens_used: update.tokensUsed ?? j.tokens_used,
                        }
                      : j,
                  ),
                );
                if (update.status === "generating" && !costEstimates[job.id]) {
                  getApiClient()
                    .get(`/api/generation/jobs/${job.id}/cost-estimate`)
                    .then((r) =>
                      setCostEstimates((prev) => ({ ...prev, [job.id]: r.data })),
                    )
                    .catch(() => void 0);
                }
              } catch {
                // Malformed frame — ignore
              }
            }
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return;
        } finally {
          delete sseRefs.current[job.id];
        }
      })();
    });

    return () => {
      Object.values(sseRefs.current).forEach((c) => c.abort());
      sseRefs.current = {};
    };
  }, [jobs, token, API_BASE, loadJobs, costEstimates]);



  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!pastedText.trim() && !file) {
      setError("Paste some text or choose a file to import.");
      return;
    }

    setSubmitting(true);
    try {
      let sourceType: SourceType = "text";
      let sourceContent = pastedText.trim();
      let sourceName = "Pasted text";

      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        sourceType = EXTENSION_TO_TYPE[extension];
        if (!sourceType) {
          setError(
            `Unsupported file type ".${extension}". Supported: .txt, .md, .pdf, .srt, .docx, .epub`,
          );
          setSubmitting(false);
          return;
        }
        sourceName = file.name;
        sourceContent =
          sourceType === "text" ? await file.text() : await fileToBase64(file);
      }

      const { data } = await getApiClient().post("/api/generation/jobs", {
        sourceName,
        sourceType,
        sourceContent,
      });

      setPastedText("");
      setFile(null);

      // Optimistically add the new job so the SSE listener picks it up
      setJobs((prev) => [data.job, ...prev.filter((j) => j.id !== data.job.id)]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Could not start the import. Check the AI provider key is configured.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const activeJobs = jobs.filter(
    (j) => j.status !== "committed" && j.status !== "failed",
  );
  const completedJobs = jobs.filter(
    (j) => j.status === "committed" || j.status === "failed",
  );

  return (
    <AuthenticatedPage>
      <AppShell
        title="AI Import"
        description="Paste text or upload a file — Gemini analyses it, identifies vocabulary worth learning, and writes complete lessons. No ChatGPT account or manual steps needed."
      >
        <div className="mx-auto max-w-3xl space-y-6">
          <AiConfigBanner config={aiConfig} />

          {/* ── Input form ── */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">New import</h2>
            <p className="mt-1 text-sm text-slate-500">
              Supported: plain text, .txt, .md, .pdf, .srt, .docx, .epub · Max ~500 KB
            </p>

            {aiConfig && (
              <p className="mt-2 text-xs text-slate-400">
                Using{" "}
                <span className="font-medium text-slate-600">{aiConfig.primaryModel}</span>
                {aiConfig.escalationConfigured ? " with Pro escalation" : ""}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <textarea
                className="h-40 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                placeholder="Paste an article, chapter, dialogue, or any English text here…"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                disabled={Boolean(file) || submitting}
              />

              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="text-slate-400">or upload a file</span>
                <label className="cursor-pointer">
                  <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {file ? file.name : "Choose file…"}
                  </span>
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.srt,.docx,.epub"
                    className="sr-only"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setPastedText("");
                    }}
                    disabled={Boolean(pastedText.trim()) || submitting}
                  />
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕ clear
                  </button>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || (!pastedText.trim() && !file)}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Starting…" : "Start import"}
              </button>
            </form>
          </section>

          {/* ── Active jobs ── */}
          {activeJobs.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                In progress
              </h2>
              {activeJobs.map((job) => (
                <PipelineProgress
                  key={job.id}
                  job={job}
                  costEstimate={dismissedCosts.has(job.id) ? null : (costEstimates[job.id] ?? null)}
                  onDismissCost={() =>
                    setDismissedCosts((prev) => new Set([...prev, job.id]))
                  }
                />
              ))}
            </section>
          )}

          {/* ── How it works ── */}
          {activeJobs.length === 0 && jobs.length === 0 && (
            <section className="rounded-xl border border-blue-100 bg-blue-50 p-6">
              <h2 className="font-semibold text-slate-900">How it works</h2>
              <ol className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-4">
                {[
                  ["1", "Paste or upload", "Add any English text — article, script, book chapter."],
                  ["2", "AI identifies vocabulary", "Gemini Flash finds words worth learning from your text."],
                  ["3", "Lessons are written", "Full 8-section lessons generated for each word."],
                  ["4", "Added to your deck", "Words enter your spaced-repetition review queue."],
                ].map(([n, title, desc]) => (
                  <li key={n} className="rounded-lg bg-white p-4">
                    <span className="text-xs font-bold text-blue-700">STEP {n}</span>
                    <p className="mt-1 font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{desc}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* ── Completed jobs ── */}
          {completedJobs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Recent imports
              </h2>
              {completedJobs.slice(0, 10).map((job) => (
                <PipelineProgress
                  key={job.id}
                  job={job}
                  costEstimate={null}
                  onDismissCost={() => void 0}
                />
              ))}
            </section>
          )}
        </div>
      </AppShell>
    </AuthenticatedPage>
  );
}
