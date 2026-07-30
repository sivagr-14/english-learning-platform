"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

interface ProgressData {
  summary: {
    totalEntries: number;
    learning: number;
    mastered: number;
    dueNow: number;
    reviews: number;
    accuracy: number;
  };
  categories: Array<{
    id: string;
    track_name: string;
    category_name: string;
    color_code: string | null;
    total: number;
    mastered: number;
  }>;
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getApiClient()
      .get("/api/progress")
      .then((response) => setData(response.data))
      .finally(() => setIsLoading(false));
  }, []);

  const summary = data?.summary;

  return (
    <AuthenticatedPage>
      <AppShell
        title="Learning Progress"
        description="Track what you are learning, what is mastered, and how accurately you recall vocabulary across categories."
      >
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Total entries", summary?.totalEntries],
            ["Learning", summary?.learning],
            ["Mastered", summary?.mastered],
            ["Due now", summary?.dueNow],
            ["Reviews", summary?.reviews],
            ["Accuracy", summary ? `${summary.accuracy}%` : undefined],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {isLoading ? "—" : (value ?? 0)}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-950">
            Category mastery
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {isLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading progress…</p>
            ) : !data?.categories.length ? (
              <div className="p-8 text-center">
                <h3 className="font-semibold text-slate-950">
                  No vocabulary to measure yet
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Add assessed content through ChatGPT, then begin learning and
                  review.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {data.categories.map((category) => {
                  const percentage = category.total
                    ? Math.round((category.mastered / category.total) * 100)
                    : 0;
                  return (
                    <article
                      key={category.id}
                      className="grid gap-4 p-5 sm:grid-cols-[minmax(180px,1fr)_2fr_100px] sm:items-center"
                    >
                      <div>
                        <h3 className="font-medium text-slate-950">
                          {category.category_name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {category.track_name}
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: category.color_code || "#2563eb",
                          }}
                        />
                      </div>
                      <p className="text-sm font-medium text-slate-700 sm:text-right">
                        {category.mastered}/{category.total} · {percentage}%
                      </p>
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
