"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import PaginationControls, {
  PaginationState,
} from "@/components/PaginationControls";
import VocabularyWordList, {
  VocabularyWordSummary,
} from "@/components/VocabularyWordList";
import { getApiClient } from "@/lib/api/client";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() || "";
  const match = [
    "all",
    "contains",
    "prefix",
    "suffix",
    "tokens",
    "exact",
  ].includes(searchParams.get("match") || "")
    ? searchParams.get("match")!
    : "all";
  const [composing, setComposing] = useState(false);
  const requestedPage = Number(searchParams.get("page") || 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 50;
  const [input, setInput] = useState(query);
  const [words, setWords] = useState<VocabularyWordSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setInput(query), [query]);

  useEffect(() => {
    if (composing || input.trim() === query) return;
    const timer = setTimeout(
      () =>
        router.replace(
          input.trim()
            ? `/search?q=${encodeURIComponent(input.trim())}&match=${match}&page=1`
            : "/search",
          { scroll: false },
        ),
      250,
    );
    return () => clearTimeout(timer);
  }, [input, query, match, composing, router]);

  useEffect(() => {
    if (!query) {
      setWords([]);
      setPagination(null);
      setIsLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    let active = true;
    setWords([]);
    setPagination(null);
    setIsLoading(true);
    setError("");
    getApiClient()
      .get("/api/vocabulary/search", {
        params: { q: query, page, limit, match },
        signal: controller.signal,
      })
      .then((response) => {
        if (!active) return;
        setWords(response.data.words);
        setPagination(response.data.pagination);
      })
      .catch(() => {
        if (active) setError("Could not search your vocabulary.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [limit, page, query, match]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = input.trim();
    router.push(
      nextQuery
        ? `/search?q=${encodeURIComponent(nextQuery)}&match=${match}&page=1`
        : "/search",
    );
  };

  const openPage = (nextPage: number) => {
    router.push(
      `/search?q=${encodeURIComponent(query)}&match=${match}&page=${nextPage}`,
    );
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title="Search vocabulary"
        description="Results update as you type. Search the whole collection, or match part of a word or expression."
      >
        <form onSubmit={submit} className="mb-7 flex flex-wrap gap-3">
          <label htmlFor="vocabulary-search" className="sr-only">
            Search vocabulary
          </label>
          <input
            id="vocabulary-search"
            type="search"
            value={input}
            maxLength={100}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a word or meaning…"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm">
            Match
            <select
              className="rounded-xl border border-slate-300 p-3"
              value={match}
              onChange={(e) =>
                router.replace(
                  `/search?q=${encodeURIComponent(input.trim())}&match=${e.target.value}&page=1`,
                  { scroll: false },
                )
              }
            >
              <option value="all">Words and meanings</option>
              <option value="contains">Contains text</option>
              <option value="prefix">Starts with</option>
              <option value="suffix">Ends with</option>
              <option value="tokens">All typed parts, any order</option>
              <option value="exact">Exact word or expression</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Search
          </button>
        </form>

        <div aria-live="polite" aria-busy={isLoading}>
          {isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
              Searching…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
              {error}
            </div>
          ) : !query ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              Enter a word, meaning or category to begin.
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-600">
                {pagination?.total || 0} results for “{query}”
              </p>
              <VocabularyWordList
                words={words}
                hrefForWord={(word) =>
                  `/vocabulary/words/${word.id}?from=search&q=${encodeURIComponent(query)}&match=${match}&page=${page}&limit=${limit}`
                }
              />
              {pagination && (
                <PaginationControls
                  pagination={pagination}
                  onPageChange={openPage}
                />
              )}
            </>
          )}
        </div>
      </AppShell>
    </AuthenticatedPage>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
