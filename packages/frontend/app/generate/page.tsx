'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api/client';
import useAuthStore from '@/lib/store/auth';

interface Category {
  id: string;
  track_name: string;
  category_name: string;
  difficulty_level: string;
}

interface ImportedItem {
  word: {
    id: string;
    word: string;
    word_type: string;
    cefr_level: string;
    frequency: string;
    english_meaning: string;
    tamil_meaning: string;
  };
  category: Category;
  lesson: any;
}

const emptySingleWord = {
  word: '',
  pronunciation: '',
  word_type: 'Verb',
  cefr_level: 'B1',
  frequency: 'Medium',
  english_meaning: '',
  tamil_meaning: '',
  core_idea: '',
  natural_domains: '',
  when_to_use: '',
  when_not_to_use: '',
  examples: '',
};

function getErrorMessage(error: any, fallback: string) {
  const responseMessage = error?.response?.data?.message;
  const responseError = error?.response?.data?.error;
  const detailMessage = Array.isArray(error?.response?.data?.details)
    ? error.response.data.details
        .map((detail: any) => detail?.message)
        .filter(Boolean)
        .join(' ')
    : '';
  const rawMessage = error?.message;

  if (responseMessage) return responseMessage;
  if (responseError) return responseError;
  if (detailMessage) return detailMessage;
  if (rawMessage === 'Network Error') {
    return 'Could not reach the backend. Please confirm the app server is running.';
  }
  if (rawMessage) return rawMessage;

  return fallback;
}

export default function GeneratePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [singleWord, setSingleWord] = useState(emptySingleWord);
  const [jsonText, setJsonText] = useState('');
  const [isSavingSingle, setIsSavingSingle] = useState(false);
  const [isImportingJson, setIsImportingJson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<ImportedItem[]>([]);

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
    if (!isHydrated || !isAuthenticated) return;

    const loadCategories = async () => {
      const response = await getApiClient().get('/api/vocabulary/categories');
      setCategories(response.data.categories);
      setCategoryId(response.data.categories[0]?.id || '');
    };

    loadCategories().catch(() => setError('Could not load categories.'));
  }, [isHydrated, isAuthenticated]);

  const submitSingle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingSingle(true);
    setError(null);
    setNotice(null);

    try {
      const response = await getApiClient().post('/api/vocabulary/import/single', {
        ...singleWord,
        categoryId,
      });

      setItems(response.data.items);
      setNotice(`${response.data.imported} vocabulary entry saved.`);
      setSingleWord(emptySingleWord);
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'Single vocabulary save failed. Please check the required fields.'
        )
      );
    } finally {
      setIsSavingSingle(false);
    }
  };

  const submitJson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsImportingJson(true);
    setError(null);
    setNotice(null);

    try {
      const response = await getApiClient().post('/api/vocabulary/import/json', {
        jsonText,
      });

      setItems(response.data.items);
      const errorText = response.data.errors?.length
        ? ` ${response.data.errors.length} item could not be imported.`
        : '';
      setNotice(`${response.data.imported} vocabulary entries imported.${errorText}`);
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'JSON import failed. Please check the vocabulary JSON format.'
        )
      );
    } finally {
      setIsImportingJson(false);
    }
  };

  const loadJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setJsonText(await file.text());
    event.target.value = '';
  };

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Add Vocabulary Lessons
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Save single entries or import one or many full vocabulary lessons from JSON.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/vocabulary')}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Vocabulary
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
          <div className="space-y-6">
            {(error || notice) && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  error
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {error || notice}
              </div>
            )}

            <form
              onSubmit={submitJson}
              className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Import JSON
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Paste one vocabulary object or an array of vocabulary objects.
                </p>
              </div>

              <textarea
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                rows={14}
                placeholder='{"word":"adapt","english_meaning":"to change so it fits a new situation","sections":[...]}'
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />

              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                  Choose JSON File
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={loadJsonFile}
                    className="sr-only"
                  />
                </label>
                <a
                  href="/samples/vocabulary-import-sample.json"
                  className="text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  Download sample JSON
                </a>
                <a
                  href="/samples/vocabulary-generation-template.json"
                  className="text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  Download generation template
                </a>
              </div>

              <button
                type="submit"
                disabled={isImportingJson}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isImportingJson ? 'Importing...' : 'Import JSON'}
              </button>
            </form>

            <form
              onSubmit={submitSingle}
              className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Single Vocabulary
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Save one entry using the same standard lesson template.
                </p>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Category
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.track_name} / {category.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Word"
                  value={singleWord.word}
                  onChange={(event) =>
                    setSingleWord({ ...singleWord, word: event.target.value })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
                <input
                  placeholder="Pronunciation"
                  value={singleWord.pronunciation}
                  onChange={(event) =>
                    setSingleWord({
                      ...singleWord,
                      pronunciation: event.target.value,
                    })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={singleWord.word_type}
                  onChange={(event) =>
                    setSingleWord({
                      ...singleWord,
                      word_type: event.target.value,
                    })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {['Verb', 'Noun', 'Adjective', 'Adverb', 'Phrase', 'Idiom'].map(
                    (type) => (
                      <option key={type}>{type}</option>
                    )
                  )}
                </select>
                <select
                  value={singleWord.cefr_level}
                  onChange={(event) =>
                    setSingleWord({
                      ...singleWord,
                      cefr_level: event.target.value,
                    })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </div>

              <select
                value={singleWord.frequency}
                onChange={(event) =>
                  setSingleWord({
                    ...singleWord,
                    frequency: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {['High', 'Medium', 'Low'].map((frequency) => (
                  <option key={frequency}>{frequency}</option>
                ))}
              </select>

              <textarea
                placeholder="English meaning"
                value={singleWord.english_meaning}
                onChange={(event) =>
                  setSingleWord({
                    ...singleWord,
                    english_meaning: event.target.value,
                  })
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <textarea
                placeholder="Tamil meaning"
                value={singleWord.tamil_meaning}
                onChange={(event) =>
                  setSingleWord({
                    ...singleWord,
                    tamil_meaning: event.target.value,
                  })
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Core idea"
                value={singleWord.core_idea}
                onChange={(event) =>
                  setSingleWord({
                    ...singleWord,
                    core_idea: event.target.value,
                  })
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Natural domains separated by semicolon"
                value={singleWord.natural_domains}
                onChange={(event) =>
                  setSingleWord({
                    ...singleWord,
                    natural_domains: event.target.value,
                  })
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />

              <button
                type="submit"
                disabled={isSavingSingle}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
              >
                {isSavingSingle ? 'Saving...' : 'Add Vocabulary'}
              </button>
            </form>
          </div>

          <main className="rounded-lg border border-gray-200 bg-white p-5">
            {items.length === 0 ? (
              <p className="text-sm text-gray-600">No imported entries yet.</p>
            ) : (
              <div className="space-y-5">
                {items.map((item) => (
                  <article
                    key={item.word.id}
                    className="border-b border-gray-200 pb-5 last:border-b-0 last:pb-0"
                  >
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          {item.word.word}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {item.category.track_name} /{' '}
                          {item.category.category_name} · {item.word.word_type} ·{' '}
                          {item.word.cefr_level}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          Lesson sections: {item.lesson?.sections?.length || 0}
                        </p>
                      </div>
                      <a
                        href={`/vocabulary/words/${item.word.id}`}
                        target={`vocabulary-word-${item.word.id}`}
                        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                      >
                        Open full lesson
                      </a>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <section>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Meaning
                        </h3>
                        <p className="mt-1 text-sm text-gray-700">
                          {item.word.english_meaning}
                        </p>
                        <p className="mt-1 text-sm text-blue-700">
                          {item.word.tamil_meaning}
                        </p>
                      </section>

                      <section>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Memory
                        </h3>
                        <p className="mt-1 text-sm text-gray-700">
                          {item.lesson?.memory_mastery?.memory_sentence}
                        </p>
                      </section>

                      <section>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Natural Domains
                        </h3>
                        <p className="mt-1 text-sm text-gray-700">
                          {item.lesson?.usage_mastery?.natural_domains?.join(', ')}
                        </p>
                      </section>

                      <section>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Mini Conversation
                        </h3>
                        <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                          {item.lesson?.mastery?.mini_conversation}
                        </p>
                      </section>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
