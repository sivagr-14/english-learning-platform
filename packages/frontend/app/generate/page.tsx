"use client";

import { useEffect, useState } from "react";
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

  const loadOverview = () => {
    setIsLoading(true);
    setError("");
    getApiClient()
      .get("/api/control/overview")
      .then((response) => setOverview(response.data))
      .catch(() =>
        setError(
          "The control history could not be loaded. Check the backend and try again.",
        ),
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(loadOverview, []);

  return (
    <AuthenticatedPage>
      <AppShell
        title="ChatGPT Content Control"
        description="This is the inspection surface for ChatGPT-managed vocabulary changes. The app never creates entries directly: assessment and exact counts come first, followed by your approval and a reconciled generation job."
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
              ["1", "Share content", "Paste text or attach a file in ChatGPT."],
              [
                "2",
                "Review counts",
                "Check new, update, duplicate and filtered totals.",
              ],
              [
                "3",
                "Approve",
                "Tell ChatGPT which proposed entries to process.",
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
        </section>

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
