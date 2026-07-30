"use client";

import { ReactNode, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

interface WordDetail {
  id: string;
  category_id: string;
  word: string;
  pronunciation: string | null;
  word_type: string | null;
  cefr_level: string;
  frequency: string;
  english_meaning: string;
  tamil_meaning: string;
  core_idea: string;
  is_starter_sample: boolean;
  track_name: string;
  category_name: string;
  category_description: string | null;
  lesson_data?: any;
}

const lessonTones = [
  "border-sky-200 bg-sky-50",
  "border-emerald-200 bg-emerald-50",
  "border-amber-200 bg-amber-50",
  "border-indigo-200 bg-indigo-50",
  "border-rose-200 bg-rose-50",
  "border-teal-200 bg-teal-50",
];

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.some(hasContent);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasContent);
  }
  return true;
}

function isSimplifiedLesson(lesson: any) {
  return (
    typeof lesson?.format_version === "string" &&
    lesson.format_version.startsWith("simplified-v")
  );
}

function hasCompleteSimplifiedLesson(lesson: any) {
  const requiredValues = [
    lesson?.overview?.meaning_usage_profile?.meaning_type,
    lesson?.overview?.meaning_usage_profile?.connotation,
    lesson?.overview?.meaning_usage_profile?.tone,
    lesson?.overview?.meaning_usage_profile?.register,
    lesson?.meaning_in_context?.source_sentence,
    lesson?.meaning_in_context?.contextual_meaning,
    lesson?.meaning_in_context?.simple_explanation,
    lesson?.usage_guide?.when_to_use,
    lesson?.usage_guide?.when_not_to_use,
    lesson?.patterns_collocations?.main_pattern,
    lesson?.patterns_collocations?.common_collocations,
    lesson?.natural_examples?.examples,
    lesson?.natural_examples?.mini_conversation,
    lesson?.mistakes_differences?.common_mistake,
    lesson?.mistakes_differences?.correction,
    lesson?.mistakes_differences?.important_difference,
    lesson?.memory_practice?.memory_trigger,
    lesson?.memory_practice?.memory_sentence,
    lesson?.memory_practice?.recall_question,
    lesson?.memory_practice?.recognition_task,
    lesson?.memory_practice?.production_task,
    lesson?.advanced_nuance,
  ];

  return requiredValues.every(hasContent);
}

function renderSimpleValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={`${index}-${String(item).slice(0, 24)}`}>
            {renderSimpleValue(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <span className="font-medium text-gray-900">
              {formatLabel(key)}:
            </span>{" "}
            {renderSimpleValue(item)}
          </div>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-line">{String(value)}</span>;
}

function LessonPanel({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  const tone = lessonTones[(number - 1) % lessonTones.length];

  return (
    <section className={`rounded-lg border p-5 ${tone}`}>
      <div className="mb-4 flex items-center gap-3 border-b border-white/70 pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-gray-900 shadow-sm">
          {number}
        </span>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm">{children}</div>
    </section>
  );
}

function FieldTable({ rows }: { rows: Array<[string, unknown]> }) {
  const visibleRows = rows.filter(([, value]) => hasContent(value));

  if (!visibleRows.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {visibleRows.map(([label, value]) => (
            <tr
              key={label}
              className="border-b border-gray-100 last:border-b-0"
            >
              <th className="w-48 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-800">
                {label}
              </th>
              <td className="px-4 py-3 text-gray-700">
                {renderSimpleValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChipList({
  values,
  tone = "bg-blue-100 text-blue-800",
}: {
  values: unknown[];
  tone?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.filter(hasContent).map((value, index) => (
        <span
          key={`${index}-${String(value)}`}
          className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}
        >
          {String(value)}
        </span>
      ))}
    </div>
  );
}

function ImportedSectionsTemplate({
  lesson,
  word,
}: {
  lesson: any;
  word: WordDetail;
}) {
  if (isSimplifiedLesson(lesson)) {
    if (!hasCompleteSimplifiedLesson(lesson)) {
      return (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-950">
            Lesson update required
          </h3>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            This entry does not yet meet the complete eight-section learning
            standard. Refresh the starter set or regenerate this entry before
            learning it.
          </p>
        </div>
      );
    }
    return <SimplifiedLessonTemplate lesson={lesson} word={word} />;
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
      <h3 className="font-semibold text-amber-950">
        Lesson regeneration required
      </h3>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        This entry uses a retired lesson format. Regenerate it with the complete
        eight-section standard before learning it.
      </p>
    </div>
  );
}

function SimplifiedLessonTemplate({
  lesson,
  word,
}: {
  lesson: any;
  word: WordDetail;
}) {
  const profile = asRecord(lesson.overview?.meaning_usage_profile);
  const context = asRecord(lesson.meaning_in_context);
  const usage = asRecord(lesson.usage_guide);
  const patterns = asRecord(lesson.patterns_collocations);
  const examples = asRecord(lesson.natural_examples);
  const differences = asRecord(lesson.mistakes_differences);
  const practice = asRecord(lesson.memory_practice);
  const advancedNuance = asArray(lesson.advanced_nuance).filter(hasContent);

  return (
    <section className="space-y-5">
      <LessonPanel number={1} title="Overview">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Meaning</h4>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {word.english_meaning}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">
                Tamil Meaning
              </h4>
              <p className="mt-2 text-sm leading-6 text-blue-700">
                {word.tamil_meaning}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Core Idea</h4>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {word.core_idea}
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">
              Meaning &amp; Usage Profile
            </h4>
            <FieldTable
              rows={[
                ["Meaning Type", profile.meaning_type],
                ["Connotation", profile.connotation],
                ["Tone", profile.tone],
                ["Register", profile.register],
              ]}
            />
          </div>
        </div>
      </LessonPanel>

      <LessonPanel number={2} title="Meaning in Context">
        <FieldTable
          rows={[
            ["Source Sentence", context.source_sentence],
            ["Meaning Here", context.contextual_meaning],
            ["Simple Explanation", context.simple_explanation],
          ]}
        />
      </LessonPanel>

      <LessonPanel number={3} title="Usage Guide">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h4 className="text-sm font-semibold text-emerald-900">
              When to use
            </h4>
            <div className="mt-3 text-sm leading-6 text-emerald-950">
              {renderSimpleValue(usage.when_to_use)}
            </div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <h4 className="text-sm font-semibold text-rose-900">
              When not to use
            </h4>
            <div className="mt-3 text-sm leading-6 text-rose-950">
              {renderSimpleValue(usage.when_not_to_use)}
            </div>
          </div>
        </div>
      </LessonPanel>

      <LessonPanel number={4} title="Patterns & Collocations">
        <div className="space-y-4">
          <FieldTable rows={[["Main Pattern", patterns.main_pattern]]} />
          <ChipList values={asArray(patterns.common_collocations)} />
        </div>
      </LessonPanel>

      <LessonPanel number={5} title="Natural Examples">
        <div className="space-y-4">
          <FieldTable rows={Object.entries(asRecord(examples.examples))} />
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-900">
              Mini Conversation
            </h4>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">
              {String(examples.mini_conversation)}
            </p>
          </div>
        </div>
      </LessonPanel>

      <LessonPanel number={6} title="Mistakes & Differences">
        <FieldTable
          rows={[
            ["Common Mistake", differences.common_mistake],
            ["Correction", differences.correction],
            ["Important Difference", differences.important_difference],
          ]}
        />
      </LessonPanel>

      <LessonPanel number={7} title="Memory & Practice">
        <FieldTable
          rows={[
            ["Memory Trigger", practice.memory_trigger],
            ["Memory Sentence", practice.memory_sentence],
            ["Recall Question", practice.recall_question],
            ["Recognition Task", practice.recognition_task],
            ["Production Task", practice.production_task],
          ]}
        />
      </LessonPanel>

      <LessonPanel number={8} title="Advanced Nuance">
        {renderSimpleValue(advancedNuance)}
      </LessonPanel>
    </section>
  );
}

export default function VocabularyWordPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [word, setWord] = useState<WordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().loadFromLocalStorage();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !params.id) return;

    const loadWord = async () => {
      setIsLoading(true);
      setError(null);
      const response = await getApiClient().get(
        `/api/vocabulary/words/${params.id}`,
      );
      setWord(response.data.word);
      setIsLoading(false);
    };

    loadWord().catch(() => {
      setError("Could not load this vocabulary entry.");
      setIsLoading(false);
    });
  }, [isHydrated, isAuthenticated, params.id]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">
              {word
                ? `${word.track_name} / ${word.category_name}`
                : "Vocabulary"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {word?.word || "Vocabulary Detail"}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/vocabulary")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Vocabulary
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Dashboard
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-600">
            Loading vocabulary...
          </div>
        ) : error || !word ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error || "Vocabulary entry not found."}
          </div>
        ) : (
          <main className="space-y-6">
            <section className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-bold text-gray-900">
                    {word.word}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    {word.pronunciation} · {word.word_type || "Word"} ·{" "}
                    {word.cefr_level}
                  </p>
                  {word.is_starter_sample && (
                    <p className="mt-2 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                      Starter sample
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  {word.frequency}
                </span>
              </div>

              {!isSimplifiedLesson(word.lesson_data) && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Meaning
                    </h3>
                    <p className="mt-2 text-sm text-gray-700">
                      {word.english_meaning}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Tamil Meaning
                    </h3>
                    <p className="mt-2 text-sm text-blue-700">
                      {word.tamil_meaning}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Core Idea
                    </h3>
                    <p className="mt-2 text-sm text-gray-700">
                      {word.core_idea}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-5 border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Vocabulary Lesson
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {word.category_description}
                </p>
              </div>
              <ImportedSectionsTemplate
                lesson={word.lesson_data || {}}
                word={word}
              />
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
