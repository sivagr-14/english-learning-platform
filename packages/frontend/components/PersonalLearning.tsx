"use client";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api/client";
export default function PersonalLearning({ wordId }: { wordId: string }) {
  const [note, setNote] = useState("");
  const [familiarity, setFamiliarity] = useState("unassessed");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoaded(false); setError("");
    getApiClient().get(`/api/vocabulary/words/${wordId}/learner-state`)
      .then(({ data }) => { if (active) { setNote(data.state.note); setFamiliarity(data.state.familiarity); setLoaded(true); } })
      .catch(() => { if (active) setError("Could not load your saved note and learning choice."); });
    return () => { active = false; };
  }, [wordId, retry]);
  async function save(choice?: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data } = await getApiClient().put(`/api/vocabulary/words/${wordId}/learner-state`, choice ? { familiarity: choice } : { note });
      setFamiliarity(data.state.familiarity); setMessage(choice ? "Learning choice saved." : "Note saved.");
    } catch { setError("Could not save. Your edits are still here; please try again."); }
    finally { setBusy(false); }
  }
  return <section className="personal-learning" aria-labelledby="personal-learning-title">
    <h2 id="personal-learning-title">Make this word yours</h2>
    {error && <p role="alert">{error} {!loaded && <button onClick={() => setRetry(n => n + 1)}>Retry</button>}</p>}
    <div className="discovery-choices">
      <button className="btn-secondary" disabled={!loaded || busy} aria-pressed={familiarity === "known"} onClick={() => save("known")}>Already know it</button>
      <button className="btn-primary" disabled={!loaded || busy} aria-pressed={familiarity === "learning"} onClick={() => save("learning")}>Want to learn</button>
    </div>
    <p className="discovery-hint">Your choice: {familiarity}. Existing review history is preserved.</p>
    <label htmlFor="personal-note">My note or memory cue</label>
    <textarea id="personal-note" value={note} maxLength={6000} disabled={!loaded || busy} onChange={e => setNote(e.target.value)} rows={3} placeholder="Connect this meaning to something in your life…" />
    <button className="btn-secondary" disabled={!loaded || busy} onClick={() => save()}>{busy ? "Saving…" : "Save note"}</button>
    <p role="status">{message}</p>
  </section>;
}
