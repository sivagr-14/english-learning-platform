"use client";
import Link from "next/link";
import { useState } from "react";
import PracticeAudio from "./PracticeAudio";

export default function QuickLesson({ word }: { word: any }) {
  const [answer, setAnswer] = useState("");
  const [reveal, setReveal] = useState(false);
  const lesson = word.lesson_data;
  if (lesson?.format_version !== "simplified-v2") return null;
  return (
    <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50 p-5">
      <h2 className="text-xl font-semibold">Understand it quickly</h2>
      <p className="text-lg">{word.english_meaning}</p>
      <p className="text-blue-800">{word.tamil_meaning}</p>
      <p>
        <strong>Core idea:</strong> {word.core_idea}
      </p>
      <blockquote className="whitespace-pre-line rounded-lg bg-white p-4">
        {lesson.natural_examples.mini_conversation}
      </blockquote>
      <PracticeAudio text={lesson.natural_examples.mini_conversation} />
      <p>
        <strong>Pattern:</strong> {lesson.patterns_collocations.main_pattern}
      </p>
      <p>
        <strong>Important difference:</strong>{" "}
        {lesson.mistakes_differences.important_difference}
      </p>
      <p>
        <strong>Memory cue:</strong> {lesson.memory_practice.memory_trigger}
      </p>
      <label className="block font-medium" htmlFor="quick-response">
        {lesson.memory_practice.production_task}
      </label>
      <textarea
        id="quick-response"
        className="w-full rounded border p-3"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Try your own sentence before revealing the reference."
      />
      <button
        className="rounded border bg-white px-3 py-2 disabled:opacity-50"
        disabled={!answer.trim()}
        onClick={() => setReveal(true)}
      >
        Show a reference example
      </button>
      {reveal && <p>{lesson.memory_practice.memory_sentence}</p>}
      <Link
        className="block font-medium text-blue-800 underline"
        href={`/practice?wordId=${word.id}`}
      >
        Practise this meaning and save progress →
      </Link>
    </section>
  );
}
