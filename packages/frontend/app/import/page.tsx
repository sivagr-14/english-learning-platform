"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

type SourceType = "text" | "pdf" | "srt" | "docx" | "epub";

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
    | "committed"
    | "failed";
  stage_progress: {
    chunksTotal?: number;
    chunksProcessed?: number;
    candidatesFound?: number;
    lessonsGenerated?: number;
    lessonsFailedValidation?: number;
    lessonsTotal?: number;
    lessonsCommitted?: number;
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
};

const EXTENSION_TO_TYPE: Record<string, SourceType> = {
  txt: "text",
  md: "text",
  pdf: "pdf",
  srt: "srt",
  docx: "docx",
  epub: "epub",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix -- the backend only wants
      // the raw base64 payload.
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface ConfigCheck {
  primaryConfigured: boolean;
  escalationConfigured: boolean;
  primaryProvider: string;
  primaryModel: string;
  escalationProvider: string;
  escalationModel: string;
}

export default function ImportPage() {
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigCheck | null>(null);
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
      .then(({ data }) => setConfig(data))
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
            `Unsupported file type ".${extension}". Supported: txt, md, pdf, srt, docx, epub.`,
          );
          setSubmitting(false);
          return;
        }
        sourceName = file.name;
        sourceContent =
          sourceType === "text" ? await file.text() : await fileToBase64(file);
      }

      await getApiClient().post("/api/generation/jobs", {
        sourceName,
        sourceType,
        sourceContent,
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

  return (
    <AuthenticatedPage>
      <AppShell
        title="Import content"
        description="Paste text or upload a supported file to generate vocabulary lessons directly in the app."
      >
        <div className="mx-auto max-w-3xl space-y-8 p-6">

          {config && !config.primaryConfigured && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              No AI provider key is configured on the server, so imports will
              fail at the &quot;Reading document&quot; step. Set{" "}
              <code className="rounded bg-amber-100 px-1">
                PRIMARY_AI_API_KEY
              </code>{" "}
              in <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
              (see <code className="rounded bg-amber-100 px-1">.env.example</code>
              ) and restart the backend/worker.
            </div>
          )}

          <form
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
                accept=".txt,.md,.pdf,.srt,.docx,.epub"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                disabled={Boolean(pastedText.trim())}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
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
          </form>

          <div className="space-y-3">
            <h2 className="text-lg font-medium">Recent imports</h2>
            {jobs.length === 0 && (
              <p className="text-sm text-gray-500">No imports yet.</p>
            )}
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </div>
      </AppShell>
    </AuthenticatedPage>
  );
}

function JobRow({ job }: { job: GenerationJob }) {
  const progress = job.stage_progress || {};
  const isTerminal = job.status === "committed" || job.status === "failed";

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
        <div className="mt-2 text-xs text-gray-500">
          {progress.lessonsTotal
            ? `Writing lessons: ${progress.lessonsGenerated ?? 0} / ${progress.lessonsTotal}`
            : progress.candidatesFound !== undefined
              ? `Found ${progress.candidatesFound} candidate words across ${progress.chunksTotal ?? 0} chunks`
              : progress.chunksTotal
                ? `Reading document (${progress.chunksTotal} chunks)`
                : "Getting started..."}
        </div>
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
