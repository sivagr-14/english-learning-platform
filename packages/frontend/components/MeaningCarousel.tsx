"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export interface MeaningSummary {
  id: string;
  word: string;
  display_label: string;
  sense_rank?: number;
  english_meaning: string;
  tamil_meaning?: string;
  word_type?: string | null;
  cefr_level?: string;
}

export default function MeaningCarousel({ current, others, contextQuery }: {
  current: MeaningSummary;
  others: MeaningSummary[];
  contextQuery: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const meanings = [current, ...others.filter(sense => sense.id !== current.id)]
    .sort((a, b) => (a.sense_rank || 1) - (b.sense_rank || 1));
  useEffect(() => {
    const selected = strip.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (selected && strip.current) strip.current.scrollLeft = selected.offsetLeft - strip.current.offsetLeft;
  }, [current.id]);
  if (meanings.length < 2) return null;
  function move(direction: number) {
    strip.current?.scrollBy({ left: direction * strip.current.clientWidth * 0.8, behavior: "smooth" });
  }
  return <nav className="meaning-carousel" aria-label="Meanings of this word">
    <div className="meaning-carousel-heading">
      <div><h2>Choose a meaning</h2><p>{meanings.length} saved meanings · A separate lesson for each</p></div>
      <div className="meaning-carousel-arrows">
        <button type="button" className="btn-secondary" aria-label="Scroll meanings left" onClick={() => move(-1)}>←</button>
        <button type="button" className="btn-secondary" aria-label="Scroll meanings right" onClick={() => move(1)}>→</button>
      </div>
    </div>
    <div className="meaning-carousel-strip" ref={strip} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const links = Array.from(strip.current?.querySelectorAll<HTMLAnchorElement>("a") || []);
      const index = links.indexOf(document.activeElement as HTMLAnchorElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
        : Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
      links[next]?.focus({ preventScroll: true });
      links[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }}>
      {meanings.map(sense => <Link key={sense.id} className="meaning-card"
        href={`/vocabulary/words/${sense.id}${contextQuery ? `?${contextQuery}` : ""}`}
        scroll={false} aria-current={sense.id === current.id ? "page" : undefined}>
        <span className="meaning-card-label">{sense.display_label || sense.word}{sense.id === current.id && <span>Selected</span>}</span>
        <span className="meaning-card-meta">{[sense.word_type, sense.cefr_level].filter(Boolean).join(" · ")}</span>
        <span className="meaning-card-definition">{sense.english_meaning}</span>
        {sense.tamil_meaning && <span data-tamil lang="ta" className="meaning-card-tamil">{sense.tamil_meaning}</span>}
      </Link>)}
    </div>
  </nav>;
}
