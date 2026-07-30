'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api/client';
import useAuthStore from '@/lib/store/auth';

interface Category {
  id: string;
  track_name: string;
  category_name: string;
  description: string | null;
  difficulty_level: string;
  estimated_words_count: number;
  color_code: string | null;
  word_count: string;
}

interface Word {
  id: string;
  word: string;
  pronunciation: string | null;
  word_type: string | null;
  cefr_level: string;
  frequency: string;
  english_meaning: string;
  tamil_meaning: string;
  core_idea: string;
  lesson_data?: any;
}

export default function VocabularyPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setIsLoading(true);
      const response = await getApiClient().get('/api/vocabulary/categories');
      const nextCategories = response.data.categories;
      setCategories(nextCategories);
      setSelectedCategory(
        nextCategories.find(
          (category: Category) => Number(category.word_count) > 0
        ) ||
          nextCategories[0] ||
          null
      );
      setIsLoading(false);
    };

    loadCategories().catch(() => setIsLoading(false));
  }, [isHydrated, isAuthenticated]);

  useEffect(() => {
    if (!selectedCategory) return;

    const loadWords = async () => {
      const response = await getApiClient().get(
        `/api/vocabulary/categories/${selectedCategory.id}/words`
      );
      setWords(response.data.words);
    };

    loadWords().catch(() => {
      setWords([]);
    });
  }, [selectedCategory]);

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Vocabulary Categories
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isLoading
                ? 'Loading categories...'
                : `${categories.length} categories available`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedCategory?.id === category.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color_code || '#2563eb' }}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {category.category_name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {category.track_name} · {category.difficulty_level} ·{' '}
                  {category.word_count}
                </p>
              </button>
            ))}
          </aside>

          <main className="rounded-lg border border-gray-200 bg-white p-6">
            {selectedCategory ? (
              <>
                <div className="mb-5 border-b border-gray-200 pb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedCategory.category_name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedCategory.description}
                  </p>
                </div>

                <div className="space-y-3">
                  {words.map((word) => (
                    <section
                      key={word.id}
                      className="rounded-lg border border-gray-200 bg-white transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <a
                        href={`/vocabulary/words/${word.id}`}
                        target={`vocabulary-word-${word.id}`}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-gray-900">
                            {word.word}
                          </h3>
                          <p className="mt-1 text-xs text-gray-500">
                            {word.word_type || 'Word'} · {word.cefr_level}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          Open
                        </span>
                      </a>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600">No categories found.</p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
