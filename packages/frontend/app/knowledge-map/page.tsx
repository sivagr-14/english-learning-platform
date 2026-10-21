"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapContext, readMapContext, mapContextQuery } from "@/lib/knowledge-map-context";
import { Suspense, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import PracticeAudio from "@/components/PracticeAudio";
import PaginationControls, { PaginationState } from "@/components/PaginationControls";
import { getApiClient } from "@/lib/api/client";

type Level = "B1" | "B2" | "C1";
type Status = "new" | "learning" | "known" | "mastered";
type MapWord = { id: string; word: string; display_label: string; word_type: string | null; pronunciation?: string; english_meaning: string; tamil_meaning: string; frequency: string; knowledge_status: Status };
type MapData = { levels: { level: Level; total: number; known?: number; learning: number; mastered: number }[]; words: MapWord[]; pagination: PaginationState };
const statusNames = { new: "Not explored", learning: "Learning", known: "Already known", mastered: "Review proficiency" };

function KnowledgeMap({ initial }: { initial: MapContext }) {
  const [level, setLevel] = useState<Level>(initial.level);
  const [query, setQuery] = useState(initial.query);
  const [status, setStatus] = useState(initial.status);
  const [page, setPage] = useState(initial.page);
  const [data, setData] = useState<MapData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const selected = data?.words.find(word => word.id === selectedId) || data?.words[0];
  const selectedIndex = data?.words.findIndex(word => word.id === selected?.id) ?? 0;
  const lessonHref = selected ? `/vocabulary/words/${selected.id}?${new URLSearchParams({ from: "map", map: mapContextQuery({ level, query, status, page, selectedId: selected.id }) })}` : "";
  const changeFilter = () => { setPage(1); setSelectedId(null); setSaveError(""); };
  async function choose(wordId: string, familiarity: "known" | "learning") {
    setSaving(true); setSaveError("");
    try {
      if (familiarity === "learning") await getApiClient().post(`/api/vocabulary/knowledge-map/${wordId}/start`);
      else await getApiClient().put(`/api/vocabulary/words/${wordId}/learner-state`, { familiarity });
      setRetry(n => n + 1);
    } catch { setSaveError("Could not save your learning choice. Try again."); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    getApiClient().get("/api/vocabulary/knowledge-map", { params: { level, page, limit: 100, q: query, status } })
      .then(({ data }) => { if (active) setData(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [level, page, retry, query, status]);
  return <AuthenticatedPage><AppShell title="Knowledge Map" description="Discover what you need to learn next." actions={<Link href="/discover" className="btn-primary">Discover words</Link>}>
    <div className="map-levels" role="tablist" aria-label="Vocabulary level">{(["B1", "B2", "C1"] as Level[]).map(item => {
      const stats = data?.levels.find(entry => entry.level === item);
      return <button key={item} role="tab" aria-selected={level === item} onClick={() => { setLevel(item); changeFilter(); }} disabled={saving}><strong>{item}</strong><span>{item === "B1" ? "Intermediate" : item === "B2" ? "Upper intermediate" : "Advanced"}</span><small>{stats?.total ?? "—"} entries</small></button>;
    })}</div>
    <form className="map-filters" onSubmit={event => event.preventDefault()}>
      <label>Find a word<input type="search" maxLength={100} value={query} disabled={saving} onChange={e => { setQuery(e.target.value); changeFilter(); }} placeholder="Word, meaning or Tamil…" /></label>
      <label>Show<select value={status} disabled={saving} onChange={e => { setStatus(e.target.value); changeFilter(); }}><option value="all">All entries</option>{Object.entries(statusNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </form>
    {saveError && <p role="alert" className="discovery-error">{saveError}</p>}
    {error ? <div role="alert" className="discovery-error">The Knowledge Map could not load. <button onClick={() => setRetry(n => n + 1)}>Try again</button></div>
      : loading ? <p role="status" className="discovery-card">Loading your map…</p>
      : !data?.words.length ? <section className="discovery-card"><h2>{query || status !== "all" ? "No entries match your filters" : `No assessed ${level} entries yet`}</h2><p>{query || status !== "all" ? "Try another search or choose All entries." : "Validated lessons will appear here after import."}</p></section>
      : selected && <>
        <article className="discovery-card map-word-card" aria-label="Selected meaning">
          <div className="map-card-top"><span className={`map-status status-${selected.knowledge_status}`}>{statusNames[selected.knowledge_status]}</span><span>{selectedIndex + 1} / {data.words.length} on this page</span></div>
          <h2><Link href={lessonHref}>{selected.display_label || selected.word}</Link></h2>
          <p className="discovery-phonetic">{selected.pronunciation} · {selected.word_type || "Expression"} · {selected.frequency} usage</p>
          <p className="discovery-meaning">{selected.english_meaning}</p>
          <p data-tamil lang="ta" className="discovery-tamil">{selected.tamil_meaning}</p>
          <PracticeAudio key={selected.id} text={selected.word} />
          <Link className="discovery-lesson" href={lessonHref}>Open lesson →</Link>
          <div className="discovery-choices">
            {selected.knowledge_status === "new" || selected.knowledge_status === "known" ? <button className="btn-primary" disabled={saving} onClick={() => choose(selected.id, "learning")}>{saving ? "Saving…" : "Start learning"}</button> : <Link className="btn-primary" href="/flashcards">Review now →</Link>}
            <button className="btn-secondary" disabled={saving || selected.knowledge_status === "known"} onClick={() => choose(selected.id, "known")}>{selected.knowledge_status === "known" ? "Already known" : "Already know it"}</button>
          </div>
          <div className="map-card-navigation"><button className="btn-secondary" disabled={saving || selectedIndex <= 0} onClick={() => { setSelectedId(data.words[selectedIndex - 1].id); setSaveError(""); }}>Previous</button><button className="btn-secondary" disabled={saving || selectedIndex >= data.words.length - 1} onClick={() => { setSelectedId(data.words[selectedIndex + 1].id); setSaveError(""); }}>Next</button></div>
        </article>
        <section className="map-grid-section" aria-label="Vocabulary map">
          <div className="map-legend">{Object.entries(statusNames).map(([key, label]) => <span key={key}><i className={`status-${key}`} />{label}</span>)}</div>
          <div className="knowledge-grid">{data.words.map((word, index) => <button key={word.id} disabled={saving} className={`knowledge-cell status-${word.knowledge_status}`} aria-pressed={selected.id === word.id} aria-label={`${word.display_label || word.word}: ${statusNames[word.knowledge_status]}`} title={word.display_label || word.word} onClick={() => { setSelectedId(word.id); setSaveError(""); }}><span>{(page - 1) * 100 + index + 1}</span></button>)}</div>
          <p className="discovery-hint">Each square is a contextual meaning. Numbers show position in this alphabetical view, not frequency rank. Select a square to explore it.</p>
          <PaginationControls pagination={data.pagination} onPageChange={next => { if (!saving) { setPage(next); setSelectedId(null); } }} />
        </section>
      </>}
  </AppShell></AuthenticatedPage>;
}


function MapRoute() {
  const params = useSearchParams();
  return <KnowledgeMap key={params.toString()} initial={readMapContext(params)} />;
}
export default function KnowledgeMapPage() {
  return <Suspense fallback={<p role="status">Loading your map…</p>}><MapRoute /></Suspense>;
}
