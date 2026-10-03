"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import PracticeAudio from "@/components/PracticeAudio";
import { getApiClient } from "@/lib/api/client";

const selectStyle = "rounded border bg-white p-2";
function Practice() {
  const params = useSearchParams();
  const wordId = params.get("wordId");
  const [skill, setSkill] = useState("recall");
  const [focus, setFocus] = useState("balanced");
  const [mode, setMode] = useState("due");
  const [cards, setCards] = useState<any[]>([]);
  const [profile, setProfile] = useState({
    timezone: "Europe/Warsaw",
    daily_minutes: 20,
    new_per_day: 10,
    focus: "balanced",
  });
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [reflection, setReflection] = useState("");
  const [context, setContext] = useState("lesson");
  const [revealed, setRevealed] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [saving, setSaving] = useState(false);
  const pending = useRef<any>(null);
  const [personal, setPersonal] = useState("");
  const [correction, setCorrection] = useState("");
  const [tags, setTags] = useState("");
  const [intent, setIntent] = useState("active");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [register, setRegister] = useState("");
  const [reload, setReload] = useState(0);
  const card = cards[index];
  const lesson = card?.lesson_data;

  useEffect(() => {
    getApiClient()
      .get("/api/fluency/profile")
      .then((r) => {
        setProfile(r.data.profile);
        setFocus(r.data.profile.focus);
      })
      .catch(() => setError("Could not load learning preferences."));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setCards([]);
    setIndex(0);
    const query = {
      skill,
      focus,
      mode,
      limit: Math.min(20, Math.max(3, Math.floor(profile.daily_minutes / 2))),
      ...(wordId ? { wordId } : {}),
      ...(search ? { q: search } : {}),
      ...(level ? { cefr: level } : {}),
      ...(register ? { register } : {}),
    };
    Promise.all([
      getApiClient().get("/api/fluency/practice", { params: query }),
      getApiClient().get("/api/fluency/summary"),
    ])
      .then(([r, s]) => {
        if (active) {
          setCards(r.data.cards);
          setSummary(s.data);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load practice. Check that the app migrations have completed.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    skill,
    focus,
    mode,
    wordId,
    reload,
    profile.daily_minutes,
    search,
    level,
    register,
  ]);
  useEffect(() => {
    setAnswer("");
    setReflection("");
    setContext("lesson");
    setRevealed(false);
    setChecks([false, false, false]);
    pending.current = null;
    setPersonal(card?.personal_example || "");
    setCorrection(card?.correction_request || "");
    setTags((card?.tags || []).join(", "));
    setIntent(card?.learning_intent || "active");
  }, [card]);

  const save = async (successful: boolean) => {
    if (!card || saving || !answer.trim()) return;
    setSaving(true);
    setError("");
    pending.current ||= {
      id: crypto.randomUUID(),
      word_id: card.id,
      skill,
      successful,
      answer,
      reflection,
      context,
      phase: mode === "diagnostic" ? "diagnostic" : "practice",
    };
    try {
      const r = await getApiClient().post(
        "/api/fluency/attempts",
        pending.current,
      );
      setNotice(
        `Saved as self-assessed practice${r.data.state ? ` · ${r.data.state.stage}` : ""}.`,
      );
      pending.current = null;
      setIndex((i) => i + 1);
      const s = await getApiClient().get("/api/fluency/summary");
      setSummary(s.data);
    } catch {
      setError(
        "Could not confirm the save. Retry; the same response identity prevents duplicate progress.",
      );
    } finally {
      setSaving(false);
    }
  };
  const saveProfile = async () => {
    try {
      const { timezone, daily_minutes, new_per_day } = profile;
      await getApiClient().put("/api/fluency/profile", {
        timezone,
        daily_minutes,
        new_per_day,
        focus,
      });
      setNotice("Learning preferences saved.");
      setReload((v) => v + 1);
    } catch {
      setError(
        "Could not save preferences. Check the timezone and numeric limits.",
      );
    }
  };
  const saveNotes = async () => {
    if (!card) return;
    try {
      await getApiClient().put(`/api/fluency/notes/${card.id}`, {
        personal_example: personal,
        correction_request: correction,
        tags: [
          ...new Set(
            tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        ],
        learning_intent: intent,
      });
      setNotice(
        "Personal example, tags and correction note saved. Corrections require a reviewed replacement lesson.",
      );
    } catch {
      setError("Could not save notes.");
    }
  };
  const prompt = !lesson
    ? ""
    : skill === "recognition"
      ? lesson.memory_practice.recognition_task
      : skill === "listening"
        ? "Listen, then write what the expression means in this conversation."
        : skill === "recall"
          ? `Recall the English expression: ${card.english_meaning}`
          : context === "lesson"
            ? lesson.memory_practice.production_task
            : `Use this meaning in ${context === "work" ? "a workplace update, request or discussion" : context === "daily_life" ? "an everyday conversation" : "a different situation from the lesson"}: ${card.english_meaning}`;

  return (
    <AppShell
      title="Fluency Practice"
      description="Understand → recall → respond → revisit. Progress here is self-assessed, not an automated fluency score."
    >
      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded bg-emerald-50 p-3 text-emerald-900"
          >
            {notice}
          </p>
        )}
        <details className="rounded border bg-white p-4">
          <summary className="cursor-pointer font-semibold">
            Daily plan and preferences
          </summary>
          <p className="my-3">
            Start with due recall, listen to a conversation, then produce a
            spoken or written response. Diagnose one skill at a time; this is a
            gap check, not a CEFR certification.
          </p>
          <div className="flex flex-wrap gap-3">
            <label>
              Minutes per day{" "}
              <input
                aria-label="Minutes per day"
                type="number"
                min={5}
                max={120}
                className={selectStyle}
                value={profile.daily_minutes}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    daily_minutes: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              New practice entries{" "}
              <input
                aria-label="New practice entries"
                type="number"
                min={0}
                max={30}
                className={selectStyle}
                value={profile.new_per_day}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    new_per_day: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Timezone{" "}
              <input
                className={selectStyle}
                value={profile.timezone}
                onChange={(e) =>
                  setProfile({ ...profile, timezone: e.target.value })
                }
              />
            </label>
            <button
              className="rounded bg-blue-700 px-4 py-2 text-white"
              onClick={saveProfile}
            >
              Save preferences
            </button>
          </div>
        </details>
        <div className="flex flex-wrap gap-3 rounded border bg-white p-4">
          <label>
            Skill{" "}
            <select
              disabled={saving}
              className={selectStyle}
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            >
              {[
                "recognition",
                "recall",
                "listening",
                "speaking",
                "writing",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Path{" "}
            <select
              disabled={saving}
              className={selectStyle}
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            >
              <option value="balanced">All situations</option>
              <option value="professional">Professional communication</option>
              <option value="conversation">Natural conversation</option>
              <option value="linking">Linking ideas</option>
            </select>
          </label>
          <label>
            Session{" "}
            <select
              disabled={saving}
              className={selectStyle}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="due">Daily practice</option>
              <option value="diagnostic">Check my gaps</option>
              <option value="mistakes">Revisit mistakes</option>
            </select>
          </label>
          <label>
            Level{" "}
            <select
              className={selectStyle}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">All</option>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Register{" "}
            <select
              className={selectStyle}
              value={register}
              onChange={(e) => setRegister(e.target.value)}
            >
              <option value="">All</option>
              {[
                "informal",
                "neutral",
                "professional",
                "formal",
                "academic",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Find an expression{" "}
            <input
              className={selectStyle}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {loading ? (
          <p>Loading practice…</p>
        ) : !card ? (
          <div className="rounded border bg-white p-6">
            <h2 className="text-xl font-semibold">
              {cards.length ? "Session finished" : "No matching practice due"}
            </h2>
            <p className="my-3">
              Try another skill or path, or return when your next review is due.
            </p>
            <button
              className={selectStyle}
              onClick={() => setReload((v) => v + 1)}
            >
              Refresh
            </button>{" "}
            <Link href="/coverage" className="text-blue-700 underline">
              See content gaps
            </Link>
          </div>
        ) : (
          <article className="space-y-4 rounded-xl border bg-white p-6">
            <p className="text-sm text-slate-500">
              {index + 1} / {cards.length} · {card.cefr_level} ·{" "}
              {card.state?.stage || "New for this skill"}
            </p>
            <h2 className="text-xl font-semibold">
              {revealed ? card.display_label : "Your turn"}
            </h2>
            <p className="text-lg">{prompt}</p>
            {(skill === "speaking" || skill === "writing") && (
              <label className="block">
                Situation{" "}
                <select
                  className={selectStyle}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                >
                  <option value="lesson">Lesson situation</option>
                  <option value="work">Workplace</option>
                  <option value="daily_life">Daily life</option>
                  <option value="new_situation">A new situation</option>
                </select>
              </label>
            )}
            {(skill === "listening" || skill === "speaking") && (
              <PracticeAudio
                key={`${card.id}:${skill}`}
                text={lesson.natural_examples.mini_conversation}
                record={skill === "speaking"}
              />
            )}
            <label className="block font-medium" htmlFor="practice-answer">
              {skill === "speaking"
                ? "Say your response, then note the sentence you used"
                : "Your response"}
            </label>
            <textarea
              id="practice-answer"
              className="min-h-28 w-full rounded border p-3"
              maxLength={6000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <button
              disabled={!answer.trim()}
              className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => setRevealed(true)}
            >
              Compare with the lesson
            </button>
            {revealed && (
              <div className="space-y-4 rounded bg-sky-50 p-4">
                <p>
                  <strong>{card.display_label}:</strong> {card.english_meaning}
                </p>
                <p>{card.tamil_meaning}</p>
                <blockquote className="whitespace-pre-line">
                  {lesson.natural_examples.mini_conversation}
                </blockquote>
                <p>
                  <strong>Pattern:</strong>{" "}
                  {lesson.patterns_collocations.main_pattern}
                </p>
                <p>
                  <strong>Watch for:</strong>{" "}
                  {lesson.mistakes_differences.important_difference}
                </p>
                <p>
                  <strong>Example:</strong>{" "}
                  {lesson.memory_practice.memory_sentence}
                </p>
                <p className="text-sm">
                  Your answer can differ. Check it yourself against the meaning,
                  pattern and usage; the app does not grade free text.
                </p>
                {[
                  "I used or understood the correct meaning.",
                  "My wording fits the pattern and collocations.",
                  "The wording suits this situation and tone.",
                ].map((label, i) => (
                  <label key={label} className="block">
                    <input
                      type="checkbox"
                      checked={checks[i]}
                      onChange={(e) =>
                        setChecks((c) =>
                          c.map((v, j) => (i === j ? e.target.checked : v)),
                        )
                      }
                    />{" "}
                    {label}
                  </label>
                ))}
                <label className="block">
                  What should I improve?
                  <textarea
                    className="mt-1 w-full rounded border p-2"
                    maxLength={2000}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                  />
                </label>
                <div className="flex gap-3">
                  <button
                    disabled={saving}
                    className="rounded bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => save(false)}
                  >
                    Needs practice
                  </button>
                  <button
                    disabled={saving || !checks.every(Boolean)}
                    className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
                    onClick={() => save(true)}
                  >
                    I could do this
                  </button>
                </div>
              </div>
            )}
            <details className="rounded border p-3">
              <summary className="cursor-pointer">
                Personal example, tags and correction note
              </summary>
              <label className="mt-3 block">
                My example
                <textarea
                  className="w-full rounded border p-2"
                  value={personal}
                  onChange={(e) => setPersonal(e.target.value)}
                />
              </label>
              <label className="block">
                Tags, separated by commas
                <input
                  className="w-full rounded border p-2"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>
              <label className="block">
                Lesson issue to review
                <textarea
                  className="w-full rounded border p-2"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                />
              </label>
              <label className="block">
                Learning goal{" "}
                <select
                  className={selectStyle}
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                >
                  <option value="active">Use it actively</option>
                  <option value="recognition">Understand it only</option>
                </select>
              </label>
              <button
                className="mt-3 rounded border px-3 py-2"
                onClick={saveNotes}
              >
                Save notes
              </button>
            </details>
            <Link
              href={`/vocabulary/words/${card.id}`}
              className="text-blue-700 underline"
            >
              Open the full eight-section lesson
            </Link>
          </article>
        )}
        <section className="rounded border bg-white p-5">
          <h2 className="text-lg font-semibold">Evidence by skill</h2>
          <p className="my-2 text-sm">
            Same-day repetitions cannot establish retention. Production requires
            successful practice on different days and in different situations.
          </p>
          <div className="flex flex-wrap gap-3">
            {summary?.skills?.map((s: any) => (
              <p
                className="rounded bg-slate-50 p-3"
                key={`${s.skill}:${s.stage}`}
              >
                {s.skill} · {s.stage}: {s.count}
              </p>
            ))}
          </div>
          <details className="mt-4">
            <summary>Recent responses and mistakes</summary>
            {summary?.attempts?.map((a: any) => (
              <article className="border-b py-3" key={a.id}>
                <p>
                  <strong>{a.word}</strong> — {a.english_meaning} · {a.skill} ·{" "}
                  {a.successful ? "Self-assessed success" : "Needs practice"}
                </p>
                <p className="whitespace-pre-line">{a.answer}</p>
                {a.reflection && (
                  <p className="text-amber-800">{a.reflection}</p>
                )}
                <Link
                  className="text-blue-700 underline"
                  href={`/practice?wordId=${a.word_id}`}
                >
                  Practise this meaning
                </Link>
              </article>
            ))}
          </details>
        </section>
      </div>
    </AppShell>
  );
}
export default function PracticePage() {
  return (
    <AuthenticatedPage>
      <Suspense fallback={<p>Loading…</p>}>
        <Practice />
      </Suspense>
    </AuthenticatedPage>
  );
}
