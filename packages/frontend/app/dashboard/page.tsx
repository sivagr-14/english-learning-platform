'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuthStore from '@/lib/store/auth';
import { getApiClient } from '@/lib/api/client';

interface VocabularySearchResult {
  id: string;
  word: string;
  word_type: string | null;
  cefr_level: string | null;
  frequency: string | null;
  english_meaning: string | null;
  tamil_meaning: string | null;
  core_idea: string | null;
  track_name: string;
  category_name: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VocabularySearchResult[]>(
    []
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  useEffect(() => {
    useAuthStore.getState().loadFromLocalStorage();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const searchVocabulary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchMessage('Enter a word or meaning to search.');
      return;
    }

    setIsSearching(true);
    setSearchMessage('');

    try {
      const response = await getApiClient().get('/api/vocabulary/search', {
        params: { q: query, limit: 12 },
      });
      setSearchResults(response.data.words);
      setSearchMessage(
        response.data.words.length
          ? ''
          : 'No vocabulary matched this search.'
      );
    } catch {
      setSearchMessage('Could not search vocabulary right now.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">English Mastery</h1>
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome back, {user.first_name || user.email}!
          </h2>
          <p className="text-gray-600">
            Search any saved vocabulary, then open the full lesson for review.
          </p>
        </div>

        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Search Vocabulary
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Find any word across all categories.
            </p>
          </div>

          <form onSubmit={searchVocabulary} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search word, meaning, Tamil meaning, or category"
              className="min-h-11 flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:bg-gray-400"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchMessage && (
            <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              {searchMessage}
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {searchResults.map((result) => (
                <Link
                  key={result.id}
                  href={`/vocabulary/words/${result.id}`}
                  target={`vocabulary-word-${result.id}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {result.word}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {result.word_type || 'Word'} · {result.cefr_level || 'Level'} ·{' '}
                        {result.category_name}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {result.frequency || 'Medium'}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-gray-700">
                    {result.english_meaning || result.core_idea}
                  </p>
                  {result.tamil_meaning && (
                    <p className="mt-1 line-clamp-1 text-sm text-blue-700">
                      {result.tamil_meaning}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Learning</h3>
            <p className="text-gray-600 text-sm mb-4">
              Browse vocabulary categories and start your learning journey
            </p>
            <Link href="/vocabulary" className="text-blue-600 hover:underline text-sm font-medium">
              Explore Categories →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">My Progress</h3>
            <p className="text-gray-600 text-sm mb-4">
              Track your learning progress and vocabulary mastery
            </p>
            <Link href="/progress" className="text-blue-600 hover:underline text-sm font-medium">
              View Progress →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Recall Cards</h3>
            <p className="text-gray-600 text-sm mb-4">
              Review due vocabulary with spaced repetition
            </p>
            <Link href="/flashcards" className="text-blue-600 hover:underline text-sm font-medium">
              Review Now →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Words</h3>
            <p className="text-gray-600 text-sm mb-4">
              Add one vocabulary or import a structured JSON deck
            </p>
            <Link href="/generate" className="text-blue-600 hover:underline text-sm font-medium">
              Add Vocabulary →
            </Link>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Account Information</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="text-blue-700 font-medium mr-4">Email:</dt>
              <dd className="text-blue-600">{user.email}</dd>
            </div>
            {user.first_name && (
              <div className="flex">
                <dt className="text-blue-700 font-medium mr-4">Name:</dt>
                <dd className="text-blue-600">
                  {user.first_name} {user.last_name || ''}
                </dd>
              </div>
            )}
            {user.current_level && (
              <div className="flex">
                <dt className="text-blue-700 font-medium mr-4">Level:</dt>
                <dd className="text-blue-600">{user.current_level}</dd>
              </div>
            )}
          </dl>
        </div>
      </main>
    </div>
  );
}
