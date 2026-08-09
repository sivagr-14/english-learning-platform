"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";
import Link from "next/link";

type SourceType =
  "text" | "md" | "html" | "vtt" | "pdf" | "srt" | "docx" | "epub";

interface GenerationJob {
  id: string;
  source_name: string;
  source_type: SourceType;
  status:
    | "queued"
    | "extracting"
    | "assessing"
    | "generating"
    | "validating"
    | "attention_required"
    | "committed"
    | "failed"
    | "cancelled";
  stage_progress: {
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
    attentionCount?: number;
    budgetBlocked?: boolean;
  };
  error_message?: string | null;
  created_at: string;
}

const STAGE_LABELS: Record<GenerationJob["status"], string> = {
  queued: "Queued",
  extracting: "Reading document",
  assessing: "Finding useful vocabulary",
  generating: "Writing lessons",
  validating: "Checking quality",
  committed: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  attention_required: "Attention required",
};

const EXTENSION_TO_TYPE: Record<string, SourceType> = {
  txt: "text",
  md: "text",
  pdf: "pdf",
  srt: "srt",
  docx: "docx",
  epub: "epub",
  html: "html",
  htm: "html",
  vtt: "vtt",
};

interface ConfigCheck {
  enabled: boolean;
  primaryConfigured: boolean;
  escalationConfigured: boolean;
  primaryProvider: string;
  primaryModel: string;
  escalationProvider: string;
  escalationModel: string;
  ollamaEnabled: boolean;
  ollamaModel: string;
  ollamaBaseUrl: string;
  defaultWorkflow: "chatgpt" | "gemini" | "ollama";
  workflows: Array<{
    id: "chatgpt" | "gemini" | "ollama";
    name: string;
    enabled: boolean;
    ready: boolean;
    prerequisite: string | null;
    cost: string;
    privacy: string;
    automation: string;
  }>;
}

export default function ImportPage() {
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigCheck | null>(null);
  const [testingProvider, setTestingProvider] = useState(false);
  const [providerMessage, setProviderMessage] = useState("");
  const [workflow, setWorkflow] = useState<"chatgpt" | "gemini" | "ollama">("chatgpt");
  const [warningBudget, setWarningBudget] = useState("1.00");
  const [hardBudget, setHardBudget] = useState("2.00");
  const [executionMode, setExecutionMode] = useState<"auto" | "standard" | "batch">("auto");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await getApiClient().get("/api/generation/jobs");
      setJobs(data.jobs);
    } catch {
      // Polling failures shouldn't interrupt the page -- just skip this tick.
    }
  }, []);

  useEffect(() => {
    // Check once on mount so the user finds out about a missing/misconfigured
    // AI key before they paste in a document and wait for a job to fail.
    getApiClient()
      .get("/api/generation/config-check")
      .then(({ data }) => {
        setConfig(data);
        setWorkflow(data.defaultWorkflow || "chatgpt");
      })
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadJobs]);

  const hasActiveJob = jobs.some(
    (job) => !["committed", "failed"].includes(job.status),
  );

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
      let sourceContent = pastedText;
      let sourceName = "Pasted text";

      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        sourceType = EXTENSION_TO_TYPE[extension];
        if (!sourceType) {
          setError(
            `Unsupported file type ".${extension}". Supported: txt, md, html, vtt, pdf, srt, docx, epub.`,
          );
          setSubmitting(false);
          return;
        }
        sourceName = file.name;
        const form = new FormData();
        form.append("file", file, file.name);
        await getApiClient().post("/api/generation/uploads", form, {
          headers: {
            "Content-Type": "multipart/form-data",
            "X-Source-Type": sourceType,
            "X-Execution-Mode": workflow === "ollama" ? "standard" : executionMode,
            "X-AI-Provider": workflow,
          },
        });
        setPastedText("");
        setFile(null);
        await loadJobs();
        return;
      }

      await getApiClient().post("/api/generation/jobs", {
        sourceName,
        sourceType,
        sourceContent,
        warningBudgetUsd: Number(warningBudget),
        hardBudgetUsd: Number(hardBudget),
        executionMode: workflow === "ollama" ? "standard" : executionMode,
        provider: workflow,
      });

      setPastedText("");
      setFile(null);
      await loadJobs();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Could not start the import. Check the AI provider key is configured.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function testProvider() {
    setTestingProvider(true);
    setProviderMessage("");
    try {
      const { data } = await getApiClient().post("/api/generation/provider/test", { provider: workflow });
      setProviderMessage(`Connected to ${data.model} in ${data.latencyMs} ms.`);
    } catch (err: any) {
      setProviderMessage(
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        `${workflow === "ollama" ? "Ollama" : "Gemini"} connection failed.`,
      );
    } finally {
      setTestingProvider(false);
    }
  }

  async function cancelJob(id: string) {
    try {
      await getApiClient().post(`/api/generation/jobs/${id}/cancel`);
      await loadJobs();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not cancel the import.");
    }
  }

  return (
    <AuthenticatedPage>
      <AppShell
        title="Import content"
        description="Paste text or upload a supported file to generate vocabulary lessons directly in the app."
      >
        <div className="mx-auto max-w-3xl space-y-8 p-6">
          {config && (
            <section aria-labelledby="workflow-heading" className="space-y-3">
              <h2 id="workflow-heading" className="text-lg font-semibold">
                Choose one workflow
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                {config.workflows.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={workflow === option.id}
                    onClick={() => setWorkflow(option.id)}
                    className={`rounded-lg border p-4 text-left ${
                      workflow === option.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <span className="font-semibold">{option.name}</span>
                    <span className={`ml-2 text-xs ${option.ready ? "text-emerald-700" : "text-amber-700"}`}>
                      {option.ready ? "Ready" : option.enabled ? "Setup required" : "Disabled"}
                    </span>
                    <span className="mt-2 block text-xs text-slate-600">{option.cost}</span>
                    <span className="mt-1 block text-xs text-slate-600">{option.privacy}</span>
                    <span className="mt-1 block text-xs text-slate-600">{option.automation}</span>
                    {option.prerequisite && (
                      <span className="mt-2 block text-xs font-medium text-amber-800">
                        {option.prerequisite}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
          {workflow === "chatgpt" && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
              Create the assessment and lesson batches in ChatGPT, then sync and claim them in ChatGPT Imports. Existing AI jobs are never changed.
              <div className="mt-3">
                <Link href="/generate" className="rounded bg-indigo-700 px-3 py-2 font-medium text-white">
                  Open ChatGPT Imports
                </Link>
              </div>
            </div>
          )}
          {workflow === "gemini" && config && !config.primaryConfigured && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              No AI provider key is configured on the server, so imports will
              fail at the &quot;Reading document&quot; step. Set{" "}
              <code className="rounded bg-amber-100 px-1">
                PRIMARY_AI_API_KEY
              </code>{" "}
              in <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
              (see{" "}
              <code className="rounded bg-amber-100 px-1">.env.example</code>)
              and restart the backend/worker.
            </div>
          )}
          {workflow === "gemini" && config && (
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Gemini: {config.enabled ? `enabled · ${config.primaryModel}` : "disabled"} · key {config.primaryConfigured ? "configured" : "missing"}</span>
                <button type="button" onClick={testProvider} disabled={!config.enabled || testingProvider} className="rounded border px-3 py-1 disabled:opacity-50">
                  {testingProvider ? "Testing…" : "Test connection"}
                </button>
              </div>
              {providerMessage && <p className="mt-2 text-slate-600">{providerMessage}</p>}
            </div>
          )}

          {workflow === "ollama" && config && (
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Ollama: {config.ollamaEnabled ? `enabled · ${config.ollamaModel}` : "disabled"} · {config.ollamaBaseUrl}</span>
                <button type="button" onClick={testProvider} disabled={!config.ollamaEnabled || testingProvider} className="rounded border px-3 py-1 disabled:opacity-50">
                  {testingProvider ? "Testing…" : "Test connection"}
                </button>
              </div>
              {providerMessage && <p className="mt-2 text-slate-600">{providerMessage}</p>}
            </div>
          )}

          {workflow !== "chatgpt" && <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-gray-200 p-5"
          >
            <textarea
              className="h-40 w-full resize-y rounded-md border border-gray-300 p-3 text-sm"
              placeholder="Paste an article, chapter, or any text here..."
              value={pastedText}
              onChange={(event) => setPastedText(event.target.value)}
              disabled={Boolean(file)}
            />
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>or</span>
              <input
                type="file"
                accept=".txt,.md,.html,.htm,.vtt,.pdf,.srt,.docx,.epub"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                disabled={Boolean(pastedText.trim())}
              />
            </div>
            {workflow === "gemini" && <fieldset className="rounded border border-slate-200 p-3 text-sm">
              <legend className="px-1 font-medium">Execution mode</legend>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {[
                  ["auto", "Automatic", "Standard for 1–20 lessons; Batch for 21+."],
                  ["standard", "Standard API", "Starts immediately at standard price."],
                  ["batch", "Batch API", "About 50% lower model cost; may take up to 24 hours."],
                ].map(([value, label, detail]) => (
                  <label key={value} className="rounded border p-3">
                    <input type="radio" name="executionMode" value={value} checked={executionMode === value} onChange={() => setExecutionMode(value as "auto" | "standard" | "batch")} />
                    <span className="ml-2 font-medium">{label}</span>
                    <span className="mt-1 block text-xs text-slate-600">{detail}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">The final automatic choice uses only approved new contextual senses requiring lessons.</p>
            </fieldset>}
            {workflow === "gemini" && <div className="grid grid-cols-2 gap-3 text-sm">
              <label>Warning budget (USD)<input className="mt-1 w-full rounded border p-2" type="number" min="0.01" step="0.01" value={warningBudget} onChange={(e) => setWarningBudget(e.target.value)} /></label>
              <label>Hard budget (USD)<input className="mt-1 w-full rounded border p-2" type="number" min="0.01" step="0.01" value={hardBudget} onChange={(e) => setHardBudget(e.target.value)} /></label>
            </div>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !config?.workflows.find((item) => item.id === workflow)?.ready}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Starting..." : "Start import"}
            </button>
            {hasActiveJob && (
              <p className="text-xs text-gray-400">
                An import is already in progress -- you can start another one,
                it&apos;ll queue behind it.
              </p>
            )}
          </form>}

          <div className="space-y-3">
            <h2 className="text-lg font-medium">Recent imports</h2>
            {jobs.length === 0 && (
              <p className="text-sm text-gray-500">No imports yet.</p>
            )}
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onCancel={cancelJob} />
            ))}
          </div>
        </div>
      </AppShell>
    </AuthenticatedPage>
  );
}

function JobRow({
  job,
  onCancel,
}: {
  job: GenerationJob;
  onCancel: (id: string) => void;
}) {
  const progress = job.stage_progress || {};
  const isTerminal = ["committed", "failed", "cancelled"].includes(job.status);

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{job.source_name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            job.status === "committed"
              ? "bg-green-100 text-green-700"
              : job.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {STAGE_LABELS[job.status]}
        </span>
      </div>

      {!isTerminal && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            {progress.lessonsTotal
              ? `Writing lessons: ${progress.lessonsGenerated ?? 0} / ${
                  progress.lessonsTotal
                }`
              : progress.candidatesFound !== undefined
                ? `Found ${progress.candidatesFound} candidate words across ${
                    progress.chunksTotal ?? 0
                  } chunks`
                : progress.chunksTotal
                  ? `Reading document (${progress.chunksTotal} chunks)`
                  : "Getting started..."}
          </span>
          <button
            type="button"
            onClick={() => onCancel(job.id)}
            className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {(progress.totalInputTokens !== undefined || progress.totalCostUsd !== undefined) && (
        <p className="mt-2 text-xs text-gray-500">
          Tokens: {(progress.totalInputTokens ?? 0) + (progress.totalOutputTokens ?? 0)} · Estimated cost: ${(progress.totalCostUsd ?? 0).toFixed(4)}
          {progress.budgetBlocked ? " · Hard budget reached; valid work is preserved." : ""}
        </p>
      )}

      {job.status === "committed" && (
        <div className="mt-2 text-xs text-gray-500">
          {progress.lessonsCommitted ?? 0} words added to your vocabulary.
        </div>
      )}

      {job.status === "failed" && job.error_message && (
        <div className="mt-2 text-xs text-red-600">{job.error_message}</div>
      )}
    </div>
  );
}
