'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api/client';
import useAuthStore from '@/lib/store/auth';

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
  track_name: string;
  category_name: string;
  category_description: string | null;
  lesson_data?: any;
}

const lessonTones = [
  'border-sky-200 bg-sky-50',
  'border-emerald-200 bg-emerald-50',
  'border-amber-200 bg-amber-50',
  'border-indigo-200 bg-indigo-50',
  'border-rose-200 bg-rose-50',
  'border-teal-200 bg-teal-50',
];

function formatLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function renderSimpleValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">Not added</span>;
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

  if (typeof value === 'object') {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key}>
            <span className="font-medium text-gray-900">
              {formatLabel(key)}:
            </span>{' '}
            {renderSimpleValue(item)}
          </div>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-line">{String(value)}</span>;
}

function StatusBadge({ value }: { value: unknown }) {
  const status = String(value || '').toLowerCase();
  const className = status.includes('yes')
    ? 'bg-emerald-100 text-emerald-700'
    : status.includes('limited')
      ? 'bg-amber-100 text-amber-700'
      : status.includes('no')
        ? 'bg-rose-100 text-rose-700'
        : 'bg-gray-100 text-gray-700';

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {String(value || 'Not set')}
    </span>
  );
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
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100 last:border-b-0">
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

function DataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    const preferredOrder = [
      'usage_area',
      'status',
      'example_sentence',
      'note',
    ];
    const allColumns = Array.from(keys);
    return [
      ...preferredOrder.filter((key) => keys.has(key)),
      ...allColumns.filter((key) => !preferredOrder.includes(key)),
    ];
  }, [rows]);

  if (!rows.length) {
    return <p className="text-sm text-gray-500">No rows added.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-900 text-white">
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left font-semibold">
                {formatLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`${rowIndex}-${JSON.stringify(row).slice(0, 18)}`}
              className="border-b border-gray-100 last:border-b-0"
            >
              {columns.map((column) => (
                <td key={column} className="px-4 py-3 align-top text-gray-700">
                  {column.toLowerCase().includes('status') ||
                  column.toLowerCase().includes('natural') ? (
                    <StatusBadge value={row[column]} />
                  ) : (
                    renderSimpleValue(row[column])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.every((item) => !!item && typeof item === 'object' && !Array.isArray(item))
  );
}

function renderSectionContent(title: string, value: unknown): ReactNode {
  if (title === 'Word Nature') {
    const record = asRecord(value);
    return (
      <FieldTable
        rows={[
          ['Primary Classification', record.primary_classification],
          ['Reason', record.reason],
        ]}
      />
    );
  }

  if (isRecordArray(value)) {
    return <DataTable rows={value} />;
  }

  return <div className="text-sm leading-6 text-gray-700">{renderSimpleValue(value)}</div>;
}

function ChipList({
  values,
  tone = 'bg-blue-100 text-blue-800',
}: {
  values: unknown[];
  tone?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.length ? (
        values.map((value, index) => (
          <span
            key={`${index}-${String(value)}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}
          >
            {String(value)}
          </span>
        ))
      ) : (
        <span className="text-sm text-gray-500">No items added.</span>
      )}
    </div>
  );
}

function ImportedSectionsTemplate({ lesson }: { lesson: any }) {
  const sections = asArray(lesson.sections).filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item)
  );

  if (!sections.length) return <StandardLessonTemplate lesson={lesson} />;

  return (
    <section className="space-y-5">
      {sections.map((section, index) => {
        const number = Number(section.number || index + 1);
        const title = String(section.title || `Section ${number}`);

        return (
          <LessonPanel key={`${number}-${title}`} number={number} title={title}>
            {renderSectionContent(title, section.content)}
          </LessonPanel>
        );
      })}
    </section>
  );
}

function MeaningExpansion({ lesson }: { lesson: any }) {
  const expansion = asRecord(lesson.meaning_expansion);
  const layers: Array<[string, unknown]> = [
    ['Layer 1 - Literal', expansion.layer_1_literal],
    ['Layer 2 - Abstract', expansion.layer_2_abstract],
    ['Layer 3 - Figurative', expansion.layer_3_figurative],
    [
      'Layer 4 - Professional / Technical',
      expansion.layer_4_professional_technical,
    ],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {layers.map(([label, value]) => (
        <div key={String(label)} className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <div className="mt-2 text-sm leading-6 text-gray-700">
            {renderSimpleValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function WordUsageZone({ lesson }: { lesson: any }) {
  const zone = asRecord(lesson.usage_mastery?.word_usage_zone);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            Natural Zones
          </h4>
          <ChipList
            values={asArray(zone.natural_zones)}
            tone="bg-emerald-100 text-emerald-800"
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            Limited Zones
          </h4>
          <ChipList
            values={asArray(zone.limited_zones)}
            tone="bg-amber-100 text-amber-800"
          />
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            Unnatural Zones
          </h4>
          <ChipList
            values={asArray(zone.unnatural_zones)}
            tone="bg-rose-100 text-rose-800"
          />
        </div>
      </div>
      <p className="rounded-lg bg-gray-50 p-4 text-sm leading-6 text-gray-700">
        {renderSimpleValue(zone.short_explanation)}
      </p>
    </div>
  );
}

function ApplicationSections({ lesson }: { lesson: any }) {
  const application = asRecord(lesson.application);

  return (
    <div className="space-y-4">
      <FieldTable rows={Object.entries(asRecord(application.examples))} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Collocations</h4>
          <div className="mt-3">
            {renderSimpleValue(application.collocations)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Native Usage Patterns
          </h4>
          <div className="mt-3">
            {renderSimpleValue(application.native_usage_patterns)}
          </div>
        </div>
      </div>
      <DataTable
        rows={asArray(application.common_mistakes).filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object' && !Array.isArray(item)
        )}
      />
    </div>
  );
}

function StandardLessonTemplate({ lesson }: { lesson: any }) {
  const usage = asRecord(lesson.usage_mastery);
  const mastery = asRecord(lesson.mastery);
  const application = asRecord(lesson.application);

  return (
    <section className="space-y-5">
      <LessonPanel number={3} title="Memory Mastery">
        <FieldTable
          rows={[
            ['Memory Trigger', lesson.memory_mastery?.memory_trigger],
            ['Visual Scene', lesson.memory_mastery?.visual_scene],
            ['Sound Association', lesson.memory_mastery?.sound_association],
            ['Tamil Connection', lesson.memory_mastery?.tamil_connection],
            ['Emotional Hook', lesson.memory_mastery?.emotional_hook],
            ['Memory Sentence', lesson.memory_mastery?.memory_sentence],
            ['Recall Question', lesson.memory_mastery?.recall_question],
            ['Pattern Family', lesson.memory_mastery?.pattern_family],
            ['Notice', lesson.memory_mastery?.notice],
          ]}
        />
      </LessonPanel>

      <LessonPanel number={4} title="Meaning Expansion">
        <MeaningExpansion lesson={lesson} />
      </LessonPanel>

      <LessonPanel number={5} title="Usage Mastery">
        <DataTable
          rows={asArray(usage.usage_profile).filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object' && !Array.isArray(item)
          )}
        />
      </LessonPanel>

      <LessonPanel number={6} title="Word Usage Zone">
        <WordUsageZone lesson={lesson} />
      </LessonPanel>

      <LessonPanel number={7} title="Natural Domains">
        <ChipList values={asArray(usage.natural_domains)} />
      </LessonPanel>

      <LessonPanel number={8} title="Domain Restrictions">
        <FieldTable rows={Object.entries(asRecord(usage.domain_restrictions))} />
      </LessonPanel>

      <LessonPanel number={9} title="Context Switching Test">
        <DataTable
          rows={asArray(usage.context_switching_test).filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object' && !Array.isArray(item)
          )}
        />
      </LessonPanel>

      <LessonPanel number={10} title="Word Nature">
        <FieldTable
          rows={[
            ['Primary Classification', usage.word_nature],
            ['Reason', usage.word_nature_reason],
          ]}
        />
      </LessonPanel>

      <LessonPanel number={11} title="Register">
        <p className="text-sm leading-6 text-gray-700">
          {renderSimpleValue(usage.register)}
        </p>
      </LessonPanel>

      <LessonPanel number={12} title="Common Contexts">
        <ChipList values={asArray(usage.common_contexts)} />
      </LessonPanel>

      <LessonPanel number={13} title="Tamil Usage Notes">
        <p className="text-sm leading-6 text-gray-700">
          {renderSimpleValue(usage.tamil_usage_notes)}
        </p>
      </LessonPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <LessonPanel number={14} title="When To Use">
          {renderSimpleValue(usage.when_to_use)}
        </LessonPanel>
        <LessonPanel number={15} title="When NOT To Use">
          {renderSimpleValue(usage.when_not_to_use)}
        </LessonPanel>
      </div>

      <LessonPanel number={16} title="Application">
        <ApplicationSections lesson={lesson} />
      </LessonPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <LessonPanel number={17} title="Collocations">
          {renderSimpleValue(application.collocations)}
        </LessonPanel>
        <LessonPanel number={18} title="Native Usage Patterns">
          {renderSimpleValue(application.native_usage_patterns)}
        </LessonPanel>
      </div>

      <LessonPanel number={19} title="Common Mistakes">
        <DataTable
          rows={asArray(application.common_mistakes).filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object' && !Array.isArray(item)
          )}
        />
      </LessonPanel>

      <LessonPanel number={20} title="Confusion Zone">
        <p className="text-sm leading-6 text-gray-700">
          {renderSimpleValue(application.confusion_zone)}
        </p>
      </LessonPanel>

      <LessonPanel number={21} title="Alternatives & Synonyms">
        {renderSimpleValue(application.alternatives_synonyms)}
      </LessonPanel>

      <LessonPanel number={22} title="Frequency By Context">
        <DataTable
          rows={asArray(application.frequency_by_context).filter(
            (item): item is Record<string, unknown> =>
              !!item && typeof item === 'object' && !Array.isArray(item)
          )}
        />
      </LessonPanel>

      <LessonPanel number={23} title="Mini Conversation">
        <p className="text-sm leading-6 text-gray-700">
          {renderSimpleValue(mastery.mini_conversation)}
        </p>
      </LessonPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <LessonPanel number={24} title="Learn The Pattern">
          {renderSimpleValue(mastery.learn_the_pattern)}
        </LessonPanel>
        <LessonPanel number={25} title="Guided Practice">
          {renderSimpleValue(mastery.guided_practice)}
        </LessonPanel>
      </div>

      <LessonPanel number={26} title="Evaluation">
        {renderSimpleValue(mastery.evaluation)}
      </LessonPanel>

      <div className="grid gap-5 lg:grid-cols-3">
        <LessonPanel number={27} title="Feedback">
          {renderSimpleValue(mastery.feedback)}
        </LessonPanel>
        <LessonPanel number={28} title="Mastery Notes">
          {renderSimpleValue(mastery.mastery_notes)}
        </LessonPanel>
        <LessonPanel number={29} title="Native Thinking Model">
          {renderSimpleValue(mastery.native_thinking_model)}
        </LessonPanel>
      </div>
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
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !params.id) return;

    const loadWord = async () => {
      setIsLoading(true);
      setError(null);
      const response = await getApiClient().get(
        `/api/vocabulary/words/${params.id}`
      );
      setWord(response.data.word);
      setIsLoading(false);
    };

    loadWord().catch(() => {
      setError('Could not load this vocabulary entry.');
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
                : 'Vocabulary'}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {word?.word || 'Vocabulary Detail'}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/vocabulary')}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Vocabulary
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
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
            {error || 'Vocabulary entry not found.'}
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
                    {word.pronunciation} · {word.word_type || 'Word'} ·{' '}
                    {word.cefr_level}
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  {word.frequency}
                </span>
              </div>

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
                  <p className="mt-2 text-sm text-gray-700">{word.core_idea}</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-5 border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Full Vocabulary Lesson
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {word.category_description}
                </p>
              </div>
              <ImportedSectionsTemplate lesson={word.lesson_data || {}} />
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
