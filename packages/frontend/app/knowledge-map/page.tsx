"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import PaginationControls, { PaginationState } from "@/components/PaginationControls";
import { getApiClient } from "@/lib/api/client";

type Level = "B1" | "B2" | "C1";
interface LevelStats {
  level: Level;
  total: number;
  learning: number;
  mastered: number;
}
interface MapWord {
  id: string;
  word: string;
  display_label: string;
  word_type: string | null;
  english_meaning: string;
  tamil_meaning: string;
  frequency: string;
  knowledge_status: "new" | "learning" | "mastered";
}
interface MapData {
  levels: LevelStats[];
  words: MapWord[];
  pagination: PaginationState;
}
const levels: Level[] = ["B1", "B2", "C1"];

export default function KnowledgeMapPage() {
  const [level, setLevel] = useState<Level>("B1");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getApiClient()
      .get("/api/vocabulary/knowledge-map", { params: { level, page, limit: 24 } })
      .then((response) => {
        if (active) setData(response.data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [level, page, retry]);

  return (
    <AuthenticatedPage>
      <AppShell
        title="Knowledge Map"
        description="Explore your assessed B1–C1 vocabulary and see what you are learning."
        actions={<Link href="/flashcards" className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Review due cards</Link>}
      >
        <div className="grid gap-4 md:grid-cols-3" role="tablist" aria-label="Vocabulary level">
          {levels.map((item) => {
            const stats = data?.levels.find((entry) => entry.level === item);
            const selected = level === item;
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => { setLevel(item); setPage(1); }}
                className={`rounded-2xl border p-5 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"}`}
              >
                <span className="text-2xl font-bold text-slate-950">{item}</span>
                <span className="ml-2 text-xs font-medium text-slate-500">{item === "B1" ? "Intermediate" : item === "B2" ? "Upper intermediate" : "Advanced"}</span>
                <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div><strong className="block text-lg text-slate-950">{stats?.total ?? "—"}</strong><span className="text-slate-500">Entries</span></div>
                  <div><strong className="block text-lg text-blue-700">{stats?.learning ?? "—"}</strong><span className="text-slate-500">Learning</span></div>
                  <div><strong className="block text-lg text-emerald-700">{stats?.mastered ?? "—"}</strong><span className="text-slate-500">Mastered</span></div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`${item} mastery`} aria-valuenow={stats?.total ? Math.round(stats.mastered / stats.total * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-emerald-500" style={{ width: `${stats?.total ? stats.mastered / stats.total * 100 : 0}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{level} words and expressions</h2>
            <p className="mt-1 text-sm text-slate-600">Open a card for Tamil meaning, practice, and the complete eight-section lesson.</p>
          </div>
          <Link href="/search" className="text-sm font-semibold text-blue-700 hover:underline">Search all vocabulary →</Link>
        </div>

        {error ? (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
            The Knowledge Map could not load. <button className="font-semibold underline" onClick={() => setRetry((value) => value + 1)}>Try again</button>
          </div>
        ) : loading ? (
          <p className="mt-5 rounded-xl border bg-white p-6 text-slate-600">Loading your map…</p>
        ) : !data?.words.length ? (
          <div className="mt-5 rounded-xl border bg-white p-8 text-center">
            <p className="font-semibold text-slate-950">No assessed {level} entries yet</p>
            <p className="mt-2 text-sm text-slate-600">Validated lessons will appear here after import.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.words.map((word) => (
                <Link key={word.id} href={`/vocabulary/words/${word.id}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-400 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-950">{word.display_label || word.word}</h3>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${word.knowledge_status === "mastered" ? "bg-emerald-100 text-emerald-800" : word.knowledge_status === "learning" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{word.knowledge_status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{word.word_type || "Expression"} · {word.frequency}</p>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-700">{word.english_meaning}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-blue-700" lang="ta">{word.tamil_meaning}</p>
                </Link>
              ))}
            </div>
            <div className="mt-6">
              <PaginationControls pagination={data.pagination} onPageChange={setPage} />
            </div>
          </>
        )}
      </AppShell>
    </AuthenticatedPage>
  );
}
