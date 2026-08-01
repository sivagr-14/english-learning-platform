import Link from "next/link";

export interface VocabularyWordSummary {
  id: string;
  word: string;
  display_label: string;
  word_type: string | null;
  cefr_level: string | null;
  frequency: string;
  english_meaning: string;
  category_name?: string;
  track_name?: string;
  is_starter_sample: boolean;
}

export default function VocabularyWordList({
  words,
  hrefForWord,
  emptyMessage = "No matching vocabulary entries were found.",
}: {
  words: VocabularyWordSummary[];
  hrefForWord: (word: VocabularyWordSummary) => string;
  emptyMessage?: string;
}) {
  if (!words.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {words.map((word) => (
        <Link
          key={word.id}
          href={hrefForWord(word)}
          className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-950">
                {word.display_label || word.word}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {word.word_type || "Word"} · {word.cefr_level || "CEFR pending"}
                {word.category_name ? ` · ${word.category_name}` : ""}
                {word.is_starter_sample ? " · Starter sample" : ""}
              </p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                {word.english_meaning}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              Open
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
