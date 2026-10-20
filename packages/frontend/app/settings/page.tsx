"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import AppShell from "@/components/AppShell";
import PracticeAudio from "@/components/PracticeAudio";
import useLearningPreferences, { defaultPreferences, LearningPreferences } from "@/lib/store/learning-preferences";

function Settings() {
  const { preferences, userId, loaded, loading, saving, error, load, save } = useLearningPreferences();
  const [draft, setDraft] = useState<LearningPreferences>(defaultPreferences);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(preferences); setSaved(false); }, [preferences]);
  const update = (change: Partial<LearningPreferences>) => { setDraft(current => ({ ...current, ...change })); setSaved(false); };
  return <AppShell title="Your learning settings" description="Make your lessons comfortable to read and hear.">
    <form className="settings-panel" onSubmit={async event => { event.preventDefault(); if (await save(draft)) setSaved(true); }}>
      <fieldset disabled={loading || saving || !userId}>
        <legend>Lesson preferences</legend>
        <label htmlFor="accent">Pronunciation accent</label>
        <select id="accent" value={draft.accent} onChange={e => update({ accent: e.target.value as LearningPreferences["accent"] })}>
          <option value="en-GB">British English</option><option value="en-US">American English</option>
        </select>
        <p>Playback uses your browser’s installed voices. Voice availability varies by device.</p>
        <label className="settings-check"><input type="checkbox" checked={draft.show_tamil} onChange={e => update({ show_tamil: e.target.checked })} />Show Tamil meanings</label>
        <p>Hide or reveal the Tamil meaning alongside English. Your saved lesson content stays intact.</p>
        <label htmlFor="theme">Appearance</label>
        <select id="theme" value={draft.theme} onChange={e => update({ theme: e.target.value as LearningPreferences["theme"] })}>
          <option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </fieldset>
      {loading && <p role="status">Loading your settings…</p>}
      {error && <p role="alert">{error} {!loaded && <button type="button" className="underline" disabled={saving || loading} onClick={() => userId && void load(userId)}>Reload saved settings</button>}</p>}
      <button className="btn-primary" disabled={loading || saving || !userId || !loaded} type="submit">{saving ? "Saving…" : "Save settings"}</button>
      {saved && <p role="status">Settings saved.</p>}
    </form>
    <section className="settings-panel" aria-labelledby="audio-preview"><h2 id="audio-preview">Try your saved voice</h2><PracticeAudio text="Small steps build lasting confidence." /></section>
    <section className="settings-panel" aria-labelledby="learning-routine"><h2 id="learning-routine">Your daily routine</h2><p>Set your time zone, practice minutes and daily new-word goal in Fluency Practice. Follow review history and recall on Progress.</p><div className="flex flex-wrap gap-3"><Link href="/practice" className="btn-secondary">Learning goals</Link><Link href="/progress" className="btn-secondary">Your progress</Link></div></section>
    <section className="settings-panel"><h2>Practice with your own lessons</h2><p>Reading, writing and speaking activities use your saved eight-section lessons. Open-ended tutoring uses a ChatGPT handoff. This app has no live AI tutor or celebrity roleplay.</p></section>
  </AppShell>;
}
export default function SettingsPage() { return <AuthenticatedPage><Settings /></AuthenticatedPage>; }
