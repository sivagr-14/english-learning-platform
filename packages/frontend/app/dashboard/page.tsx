"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import Icon from "@/components/Icon";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

type Summary = { totalEntries: number; mastered: number; dueNow: number; accuracy: number };
type Level = { total: number; known?: number; learning: number; mastered: number };
export default function DashboardPage() {
  const user = useAuthStore(state => state.user);
  const [progress, setProgress] = useState<Summary | null>(null);
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const results = await Promise.allSettled([
      getApiClient().get("/api/progress"),
      getApiClient().get("/api/vocabulary/knowledge-map", { params: { level: "B1", limit: 1, page: 1 } }),
    ]);
    setProgress(results[0].status === "fulfilled" ? results[0].value.data.summary : null);
    setLevels(results[1].status === "fulfilled" ? results[1].value.data.levels : null);
    setError(results.some(result => result.status === "rejected"));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const total = levels?.reduce((n, level) => n + level.total, 0);
  const known = levels?.reduce((n, level) => n + (level.known || 0), 0);
  const learning = levels?.reduce((n, level) => n + level.learning, 0);
  const mastered = levels?.reduce((n, level) => n + level.mastered, 0);
  const count = (n?: number) => loading || n === undefined ? "—" : n.toLocaleString();
  return <AuthenticatedPage><AppShell title="Your learning home">
    <section className="words-summary" aria-label="Your B1 to C1 vocabulary" aria-busy={loading}>
      <div className="words-summary-top"><span className="home-avatar" aria-hidden="true">{(user?.first_name || "M").slice(0, 1).toUpperCase()}</span><h2>Words in<br />your map</h2><strong>{count(total)}</strong></div>
      <div className="knowledge-track" aria-hidden="true"><span style={{ width: `${total ? (known || 0) / total * 100 : 0}%` }} /><span style={{ width: `${total ? (learning || 0) / total * 100 : 0}%` }} /></div>
      <div className="summary-counts"><span>Known <b>{count(known)}</b></span><span>Learning <b>{count(learning)}</b></span><span>Reviewed mastery <b>{count(mastered)}</b></span></div>
      <p>Assessed B1–C1 meanings in your collection</p>
    </section>
    {error && <div className="notice" role="alert">Some learning totals couldn’t load. <button onClick={load} className="underline">Try again</button></div>}
    <section className="home-section" aria-labelledby="reviews-title">
      <div className="home-section-heading"><h2 id="reviews-title">Today’s Reviews</h2><p>Words and phrases ready to remember.</p></div>
      <div className="review-home-card"><div><strong>{count(progress?.dueNow)}</strong><span>{progress?.dueNow === 0 ? "You’re all caught up" : "Ready for review"}</span><Icon name="review" width="72" height="72" /></div><Link href="/flashcards" className="btn-primary">{progress?.dueNow === 0 ? "Open your reviews" : "Start"}</Link></div>
    </section>
    <section className="home-section" aria-labelledby="map-title">
      <div className="home-section-heading"><h2 id="map-title">Knowledge Map</h2><p>Discover what you want to learn next.</p></div>
      <div className="home-explore-grid">
        <Link href="/discover" className="home-explore-card"><div className="explore-art discover-art" aria-hidden="true"><span>Aa</span><Icon name="search" width="52" height="52" /></div><strong className="explore-action">Discover</strong><span>One new meaning at a time</span></Link>
        <Link href="/knowledge-map" className="home-explore-card"><div className="explore-art map-art" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} />)}</div><strong className="explore-action">Learn</strong><span>Your B1 · B2 · C1 map</span></Link>
      </div>
    </section>
    <section className="home-section" aria-labelledby="practice-title">
      <div className="home-section-heading"><h2 id="practice-title">Practice your English</h2><p>Use your saved lessons for reading, writing and speaking.</p></div>
      <div className="home-practice-grid">{[["reading", "Read", "book"], ["writing", "Write", "book"], ["speaking", "Speak", "speak"]].map(([skill, label, icon]) => <Link key={skill} href={`/practice?skill=${skill}`} className="home-practice-card"><Icon name={icon} width="32" height="32" /><strong>{label}</strong><span>Guided practice</span></Link>)}</div>
      <p className="practice-disclosure">Practice uses your own lessons. For an open conversation, use the ChatGPT handoff in practice. No live AI tutor is connected.</p>
    </section>
    <section className="home-collection-links" aria-label="Your learning tools">{[["/categories", "My lists", "grid"], ["/progress", "My progress", "chart"], ["/settings", "Preferences & goals", "check"]].map(([href, title, icon]) => <Link key={href} href={href}><Icon name={icon} /><span>{title}</span><Icon name="arrow" /></Link>)}</section>
  </AppShell></AuthenticatedPage>;
}

