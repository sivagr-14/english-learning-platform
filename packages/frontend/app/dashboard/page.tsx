"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import Icon from "@/components/Icon";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

interface ProgressSummary {
  totalEntries: number;
  mastered: number;
  dueNow: number;
  accuracy: number;
}
const paths = [
  {
    href: "/practice?focus=professional",
    icon: "speak",
    title: "Communicate at work",
    description:
      "Practise clear updates, thoughtful disagreement and everyday professional conversations.",
    action: "Practise with purpose",
  },
  {
    href: "/vocabulary",
    icon: "book",
    title: "Find your next expression",
    description:
      "Explore meanings, natural conversations and practical examples in your vocabulary library.",
    action: "Explore your vocabulary",
  },
  {
    href: "/progress",
    icon: "chart",
    title: "See your progress",
    description:
      "Follow your review history and recall. Build confidence through regular, meaningful practice.",
    action: "View learning progress",
  },
];
export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await getApiClient().get("/api/progress");
      setProgress(result.data.summary);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const ready = !loading && !error && progress;
  const stats = [
    {
      label: "Expressions in your library",
      value: progress?.totalEntries.toLocaleString(),
    },
    { label: "Ready for review", value: progress?.dueNow.toLocaleString() },
    { label: "Recall established", value: progress?.mastered.toLocaleString() },
    {
      label: "Self-rated recall accuracy",
      value: `${progress?.accuracy ?? 0}%`,
    },
  ];
  return (
    <AuthenticatedPage>
      <AppShell
        title={
          user?.first_name
            ? `Make progress, ${user.first_name}.`
            : "A little practice. A stronger voice."
        }
        description="Build the English you can use. Start with a short review, then put an expression into your own words."
      >
        {error && (
          <div className="notice" role="alert">
            Your learning summary couldn’t load. You can still open your
            lessons.{" "}
            <button className="ml-2 underline font-semibold" onClick={load}>
              Try again
            </button>
          </div>
        )}
        <section className="learning-hero" aria-labelledby="daily-heading">
          <div>
            <p className="eyebrow">Your next step</p>
            <h2 id="daily-heading">
              {ready && progress.dueNow > 0
                ? `${progress.dueNow} opportunities to remember.`
                : "Turn understanding into conversation."}
            </h2>
            <p>
              {ready && progress.totalEntries === 0
                ? "Your library is ready for its first lessons. Explore the categories or prepare content through ChatGPT Imports."
                : "Bring familiar expressions back to mind. Then practise using them in a situation that matters to you."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="btn-primary"
                href={
                  ready && progress.dueNow > 0 ? "/flashcards" : "/practice"
                }
              >
                {ready && progress.dueNow > 0
                  ? "Start your review"
                  : "Start fluency practice"}
                <Icon name="arrow" />
              </Link>
              <Link className="btn-secondary" href="/vocabulary">
                Explore lessons
              </Link>
            </div>
          </div>
          <div
            className="learning-route"
            aria-label="A simple learning routine"
          >
            {[
              ["01", "Bring it back", "Recall before you reveal."],
              ["02", "Make it yours", "Say or write your own response."],
              ["03", "Build lasting recall", "Return on a different day."],
            ].map(([n, t, d]) => (
              <div key={n} className="route-step">
                <span>{n}</span>
                <div>
                  <strong>{t}</strong>
                  <small>{d}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section aria-label="Learning summary" aria-busy={loading}>
          <dl className="stat-grid">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>
                  {ready ? (
                    stat.value
                  ) : (
                    <span aria-label={loading ? "Loading" : "Unavailable"}>
                      —
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="paths-heading">
          <div className="section-heading">
            <h2 id="paths-heading">Make room for real-life English</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {paths.map((path) => (
              <Link key={path.href} href={path.href} className="path-card">
                <span className="path-icon">
                  <Icon name={path.icon} />
                </span>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
                <span className="path-action">
                  {path.action}
                  <Icon name="arrow" width="16" height="16" />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold">Grow a useful collection</h2>
            <p className="mt-1 text-sm text-slate-600">
              See what you have, discover gaps and add carefully reviewed
              lessons.
            </p>
          </div>
          <Link href="/coverage" className="btn-secondary">
            Explore coverage
            <Icon name="arrow" />
          </Link>
        </section>
      </AppShell>
    </AuthenticatedPage>
  );
}
