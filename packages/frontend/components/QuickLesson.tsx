"use client";
import Link from "next/link";
import { useState } from "react";
import PracticeAudio from "./PracticeAudio";
import Icon from "./Icon";

export default function QuickLesson({ word }: { word: any }) {
  const [answer, setAnswer] = useState("");
  const [reveal, setReveal] = useState(false);
  const lesson = word.lesson_data;
  if (lesson?.format_version !== "simplified-v2") return null;
  return (
    <section className="quick-lesson" aria-labelledby="quick-heading">
      <p className="eyebrow">A quick first pass</p>
      <h2
        id="quick-heading"
        className="mt-2 text-2xl font-semibold tracking-tight"
      >
        Understand it quickly
      </h2>
      <p className="mt-3 text-lg leading-relaxed">
        {lesson.meaning_in_context.contextual_meaning || word.english_meaning}
      </p>
      <p lang="ta" className="mt-2 text-sm leading-7 text-teal-900">
        {word.tamil_meaning}
      </p>
      <div className="quick-lesson-grid">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">
            01 · Hear it in a conversation
          </h3>
          <blockquote className="conversation-card">
            {lesson.natural_examples.mini_conversation}
          </blockquote>
          <PracticeAudio text={lesson.natural_examples.mini_conversation} />
          <details className="rounded-xl border border-emerald-200 p-3">
            <summary className="text-sm font-semibold">
              Why this wording works
            </summary>
            <div className="space-y-3 py-3 text-sm leading-7">
              <p>
                <strong>Pattern:</strong>{" "}
                {lesson.patterns_collocations.main_pattern}
              </p>
              <p>
                <strong>Important difference:</strong>{" "}
                {lesson.mistakes_differences.important_difference}
              </p>
              <p>
                <strong>Core idea:</strong> {word.core_idea}
              </p>
            </div>
          </details>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">02 · Make it your own</h3>
          <label className="block text-sm leading-7" htmlFor="quick-response">
            {lesson.memory_practice.production_task}
          </label>
          <textarea
            id="quick-response"
            rows={4}
            className="w-full rounded border p-3"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Try your own sentence before revealing the reference."
            aria-describedby="quick-response-note"
          />
          <p
            id="quick-response-note"
            className="text-xs leading-5 text-slate-600"
          >
            A scratchpad for this lesson. Open practice below to save a response
            and track progress.
          </p>
          <button
            className="btn-secondary disabled:opacity-50"
            disabled={!answer.trim()}
            aria-expanded={reveal}
            aria-controls="quick-reference"
            onClick={() => setReveal(!reveal)}
          >
            {reveal ? "Hide reference example" : "Show a reference example"}
          </button>
          <div
            id="quick-reference"
            hidden={!reveal}
            className="rounded-xl bg-white p-4 text-sm leading-7"
          >
            <p className="font-semibold">One possible example</p>
            {lesson.memory_practice.memory_sentence}
            <p className="mt-2 text-slate-600">
              Your wording can differ. Check the meaning, pattern and tone.
            </p>
          </div>
          <p className="text-sm leading-7">
            <strong>Memory cue:</strong> {lesson.memory_practice.memory_trigger}
          </p>
          <Link className="btn-primary" href={`/practice?wordId=${word.id}`}>
            Practise and save progress
            <Icon name="arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
