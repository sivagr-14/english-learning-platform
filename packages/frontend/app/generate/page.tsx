"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

interface AssessmentCounts {
  candidatesIdentified: number;
  alreadyPresentUnchanged: number;
  existingEntriesToUpdate: number;
  lowValueFilteredOut: number;
  newEntriesProposed: number;
  totalEntriesToProcess: number;
  heavyUseSelections: number;
  mediumUseSelections: number;
}

interface Assessment {
  id: string;
  source_name: string;
  source_type: string;
  status: string;
  counts: AssessmentCounts | string;
  created_at: string;
}

interface GenerationJob {
  id: string;
  source_name: string;
  status: string;
  total_items: number;
  completed_items: number;
  failed_items: number;
  manual_review_items: number;
  created_at: string;
}

interface Overview {
  summary: {
    vocabularyEntries: number;
    assessments: number;
    pendingApproval: number;
    activeJobs: number;
  };
  assessments: Assessment[];
  jobs: GenerationJob[];
}

function readCounts(value: Assessment["counts"]): AssessmentCounts {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function statusTone(status: string) {
  if (["completed", "reconciled"].includes(status)) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (["failed", "manual_review"].includes(status)) {
    return "bg-red-100 text-red-800";
  }
  if (["approved", "processing"].includes(status)) {
    return "bg-blue-100 text-blue-800";
  }
  return "bg-amber-100 text-amber-800";
}

export default function ControlPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState("Pasted learning content");
  const [sourceText, setSourceText] = useState("");
  const [isAssessing, setIsAssessing] = useState(false);
  const [approvingId, setApprovingId] = useState("");
  const [automation, setAutomation] = useState({
    configured: false,
    model: "",
  });

  const loadOverview = () => {
    setIsLoading(true);
    setError("");
    Promise.all([
      getApiClient().get("/api/control/overview"),
      getApiClient().get("/api/control/automation-status"),
    ])
      .then(([overviewResponse, automationResponse]) => {
        setOverview(overviewResponse.data);
        setAutomation(automationResponse.data);
      })
      .catch(() =>
        setError(
          "The control history could not be loaded. Check the backend and try again.",
        ),
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(loadOverview, []);

  useEffect(() => {
    if (!overview?.summary.activeJobs) return;
    const timer = window.setInterval(loadOverview, 4000);
    return () => window.clearInterval(timer);
  }, [overview?.summary.activeJobs]);

  const assessContent = async (event: FormEvent) => {
    event.preventDefault();
    setIsAssessing(true);
    setError("");
    try {
      await getApiClient().post("/api/control/assess-text", {
        name: sourceName,
        text: sourceText,
      });
      setSourceText("");
      loadOverview();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "The content could not be assessed.",
      );
    } finally {
      setIsAssessing(false);
    }
  };

  const approve = async (assessmentId: string) => {
    setApprovingId(assessmentId);
    setError("");
    try {
      await getApiClient().post(
        `/api/control/assessments/${assessmentId}/approve`,
        {},
      );
      loadOverview();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.error ||
          "The generation job could not be started.",
      );
    } finally {
      setApprovingId("");
    }
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title="Automated Vocabulary"
        description="Paste learning content, review the proposed count, approve it, and let the local backend validate and save complete lessons into PostgreSQL."
        actions={
          <button
            type="button"
            onClick={loadOverview}
            disabled={isLoading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Refresh status
          </button>
        }
      >
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            Add or update vocabulary
          </h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-4">
            {[
              ["1", "Paste content", "Add text directly in this local app."],
              [
                "2",
                "Review counts",
                "Check new, update, duplicate and filtered totals.",
              ],
              [
                "3",
                "Approve",
                "Start generation only after confirming the count.",
              ],
              [
                "4",
                "Reconcile",
                "Every approved entry is completed, failed or held for review.",
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
            {automation.configured
              ? `OpenAI connection ready · ${automation.model}`
              : "OpenAI connection not configured · add OPENAI_API_KEY to .env.local and restart current"}
          </p>
        </section>

        <form
          onSubmit={assessContent}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            Assess new content
          </h2>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Source name
            <input
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950"
              required
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Text
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              rows={8}
              minLength={20}
              maxLength={150000}
              placeholder="Paste a paragraph, article excerpt, subtitle text or other learning content…"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 leading-6 text-slate-950"
              required
            />
          </label>
          <button
            type="submit"
            disabled={isAssessing || !automation.configured}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAssessing ? "Assessing…" : "Assess content"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <section className="mt-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Assessment history
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Counts shown here are saved before any vocabulary mutation.
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {overview?.summary.assessments || 0} total
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Loading control history…
              </div>
            ) : !overview?.assessments.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <h3 className="font-semibold text-slate-950">
                  No assessments yet
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Share your first text, subtitle, PDF, document or vocabulary
                  file with ChatGPT. The proposed counts will appear here after
                  assessment.
                </p>
              </div>
            ) : (
              overview.assessments.map((assessment) => {
                const counts = readCounts(assessment.counts);
                return (
                  <article
                    key={assessment.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <h3 className="font-semibold text-slate-950">
                          {assessment.source_name}
                        </h3>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {assessment.source_type} ·{" "}
                          {new Date(assessment.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`self-start rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(
                          assessment.status,
                        )}`}
                      >
                        {assessment.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                      {[
                        ["Candidates", counts.candidatesIdentified],
                        ["New", counts.newEntriesProposed],
                        ["Updates", counts.existingEntriesToUpdate],
                        ["Unchanged", counts.alreadyPresentUnchanged],
                        ["Filtered", counts.lowValueFilteredOut],
                        ["Heavy use", counts.heavyUseSelections],
                        ["To process", counts.totalEntriesToProcess],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="mt-1 text-lg font-semibold text-slate-950">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {assessment.status === "assessed" &&
                      counts.totalEntriesToProcess > 0 && (
                        <button
                          type="button"
                          onClick={() => approve(assessment.id)}
                          disabled={approvingId === assessment.id}
                          className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {approvingId === assessment.id
                            ? "Starting…"
                            : `Approve and generate ${counts.totalEntriesToProcess}`}
                        </button>
                      )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-950">
            Generation jobs
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {!overview?.jobs.length ? (
              <p className="p-6 text-sm text-slate-600">
                No approved generation jobs yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {overview.jobs.map((job) => {
                  const accounted =
                    Number(job.completed_items) +
                    Number(job.failed_items) +
                    Number(job.manual_review_items);
                  const percentage = job.total_items
                    ? Math.round((accounted / job.total_items) * 100)
                    : 0;
                  return (
                    <article key={job.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-slate-950">
                            {job.source_name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {job.completed_items} complete · {job.failed_items}{" "}
                            failed · {job.manual_review_items} manual review
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(
                            job.status,
                          )}`}
                        >
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div
                        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
                        aria-label={`${percentage}% accounted for`}
                      >
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </AppShell>
    </AuthenticatedPage>
  );
}
