"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

interface ProgressSummary {
  totalEntries: number;
  learning: number;
  mastered: number;
  dueNow: number;
  reviews: number;
  accuracy: number;
}

interface ControlSummary {
  assessments: number;
  pendingApproval: number;
  activeJobs: number;
}

const emptyProgress: ProgressSummary = {
  totalEntries: 0,
  learning: 0,
  mastered: 0,
  dueNow: 0,
  reviews: 0,
  accuracy: 0,
};

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [progress, setProgress] = useState(emptyProgress);
  const [control, setControl] = useState<ControlSummary>({
    assessments: 0,
    pendingApproval: 0,
    activeJobs: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getApiClient().get("/api/progress"),
      getApiClient().get("/api/control/overview"),
    ])
      .then(([progressResponse, controlResponse]) => {
        setProgress(progressResponse.data.summary);
        setControl(controlResponse.data.summary);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const stats = [
    { label: "Vocabulary", value: progress.totalEntries },
    { label: "Due now", value: progress.dueNow },
    { label: "Mastered", value: progress.mastered },
    { label: "Accuracy", value: `${progress.accuracy}%` },
  ];

  return (
    <AuthenticatedPage>
      <AppShell
        title={`Welcome, ${user?.first_name || "learner"}`}
        description="Your personal vocabulary workspace. New and updated entries arrive only after ChatGPT assesses the source, reports exact counts, and receives your approval."
      >
        <section
          aria-label="Learning summary"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {isLoading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Daily focus
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              {progress.dueNow
                ? `${progress.dueNow} vocabulary cards are ready`
                : "Your review queue is clear"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review one category at a time and rate how easily you recalled the
              answer. Your next review date adjusts after every response.
            </p>
            <Link
              href="/flashcards"
              className="mt-5 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              {progress.dueNow ? "Start review" : "Open review queue"}
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ChatGPT control
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Content processing
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {control.activeJobs} active
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Assessments</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-950">
                  {control.assessments}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Awaiting approval</dt>
                <dd className="mt-1 text-xl font-semibold text-slate-950">
                  {control.pendingApproval}
                </dd>
              </div>
            </dl>
            <Link
              href="/generate"
              className="mt-5 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              View control history →
            </Link>
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-lg font-semibold text-slate-950">Continue</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {[
              {
                href: "/vocabulary",
                title: "Vocabulary library",
                description:
                  "Browse complete lessons by category, CEFR and usage value.",
              },
              {
                href: "/progress",
                title: "Learning progress",
                description:
                  "See mastery, review accuracy and category coverage.",
              },
              {
                href: "/generate",
                title: "Add content through ChatGPT",
                description:
                  "Share text or a file in ChatGPT, then inspect assessment and processing status here.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:bg-blue-50"
              >
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </AppShell>
    </AuthenticatedPage>
  );
}
