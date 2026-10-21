"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { readLearningLevel } from "@/lib/knowledge-map-context";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import PracticeAudio from "@/components/PracticeAudio";
import { getApiClient } from "@/lib/api/client";

type Word = { id: string; word: string; display_label: string; word_type: string; pronunciation: string; english_meaning: string; tamil_meaning: string };
function Discovery({ initialLevel }: { initialLevel: string }) {
  const [level, setLevel] = useState(initialLevel);
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [completed, setCompleted] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getApiClient().get("/api/vocabulary/knowledge-map", { params: { level, status: "new", page: 1, limit: 1 } })
      .then(({ data }) => { if (active) setWord(data.words[0] || null); })
      .catch(() => { if (active) setError("Could not load your next word. Please retry."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [level, revision]);
  async function choose(familiarity: "known" | "learning") {
    if (!word || saving) return;
    setSaving(true); setError("");
    try {
      await getApiClient().put(`/api/vocabulary/words/${word.id}/learner-state`, { familiarity });
      setCompleted(n => n + 1); setRevision(n => n + 1);
    } catch { setError("Your choice was not saved. Try again before continuing."); }
    finally { setSaving(false); }
  }
  return <AppShell title="Discover your next word" description="One meaning at a time. Choose what you want to learn." actions={<Link className="btn-secondary" href="/knowledge-map">View Knowledge Map</Link>}>
    <div className="discovery-layout">
      <section className="discovery-toolbar" aria-label="Discovery settings">
        <label htmlFor="discovery-level">Your level</label>
        <select id="discovery-level" value={level} disabled={saving} onChange={e => { setLevel(e.target.value); setCompleted(0); }}><option>B1</option><option>B2</option><option>C1</option></select>
        <span aria-live="polite">{completed} explored this session</span>
      </section>
      {error && <p role="alert" className="discovery-error">{error} <button onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
      {loading ? <p role="status" className="discovery-card">Finding your next word…</p> : !error && !word ? <section className="discovery-card"><h2>You have explored every available {level} entry</h2><p>Choose another level or return to your review queue.</p><Link className="btn-primary" href="/flashcards">Review your words</Link></section> : word && !loading && <article className="discovery-card" key={word.id}>
        <div className="discovery-orbit" aria-hidden="true">Aa</div>
        <p className="eyebrow">{level} · {word.word_type || "Expression"}</p>
        <h2>{word.display_label || word.word}</h2>
        <p className="discovery-phonetic">{word.pronunciation}</p>
        <p className="discovery-meaning">{word.english_meaning}</p>
        <p data-tamil lang="ta" className="discovery-tamil">{word.tamil_meaning}</p>
        <PracticeAudio text={word.word} />
        <Link className="discovery-lesson" href={`/vocabulary/words/${word.id}?from=discover&level=${level}`}>Explore all eight lesson sections →</Link>
        <div className="discovery-choices">
          <button disabled={saving || !!error} onClick={() => choose("known")} className="btn-secondary">Already know it</button>
          <button disabled={saving || !!error} onClick={() => choose("learning")} className="btn-primary">{saving ? "Saving…" : "I want to learn this"}</button>
        </div>
        <p className="discovery-hint">“Already know it” records your familiarity. Review proficiency comes from your review history.</p>
      </article>}
    </div>
  </AppShell>;
}
function DiscoveryRoute() {
  const params = useSearchParams();
  const level = readLearningLevel(params.get("level"));
  return <Discovery key={level} initialLevel={level} />;
}
export default function DiscoverPage() { return <AuthenticatedPage><Suspense fallback={<p role="status">Loading discovery…</p>}><DiscoveryRoute /></Suspense></AuthenticatedPage>; }
