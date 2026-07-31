"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";
import AppShell from "@/components/AppShell";

interface Category {
  id: string;
  track_name: string;
  category_name: string;
  description: string | null;
  cefr_range: string | null;
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
  is_starter_sample: boolean;
  lesson_data?: any;
}

export default function VocabularyPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [starterSamples, setStarterSamples] = useState({
    available: 0,
    loaded: 0,
    outdated: 0,
    version: 0,
  });
  const [sampleAction, setSampleAction] = useState<
    "loading" | "removing" | null
  >(null);
  const [sampleError, setSampleError] = useState("");

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
    if (!isHydrated || !isAuthenticated) return;

    const loadCategories = async () => {
      setIsLoading(true);
      const [response, sampleResponse] = await Promise.all([
        getApiClient().get("/api/vocabulary/categories"),
        getApiClient().get("/api/vocabulary/starter-samples"),
      ]);
      const nextCategories = response.data.categories;
      setCategories(nextCategories);
      setStarterSamples(sampleResponse.data);
      setSelectedCategory(
        nextCategories.find(
          (category: Category) => Number(category.word_count) > 0,
        ) || null,
      );
      setIsLoading(false);
    };

    loadCategories().catch(() => setIsLoading(false));
  }, [isHydrated, isAuthenticated]);

  const refreshVocabulary = async () => {
    const [categoryResponse, sampleResponse] = await Promise.all([
      getApiClient().get("/api/vocabulary/categories"),
      getApiClient().get("/api/vocabulary/starter-samples"),
    ]);
    const nextCategories = categoryResponse.data.categories;
    const firstActive =
      nextCategories.find(
        (category: Category) => Number(category.word_count) > 0,
      ) || null;
    setCategories(nextCategories);
    setStarterSamples(sampleResponse.data);
    setSelectedCategory(firstActive);
    setWords([]);
  };

  const loadSamples = async () => {
    setSampleAction("loading");
    setSampleError("");
    try {
      await getApiClient().post("/api/vocabulary/starter-samples");
      await refreshVocabulary();
    } catch (error: any) {
      setSampleError(
        error?.response?.data?.message || "Could not load starter samples.",
      );
    } finally {
      setSampleAction(null);
    }
  };

  const removeSamples = async () => {
    if (
      !window.confirm(
        "Remove all starter samples and their review progress? Your own vocabulary will not be changed.",
      )
    ) {
      return;
    }

    setSampleAction("removing");
    setSampleError("");
    try {
      await getApiClient().delete("/api/vocabulary/starter-samples");
      await refreshVocabulary();
    } catch (error: any) {
      setSampleError(
        error?.response?.data?.message || "Could not remove starter samples.",
      );
    } finally {
      setSampleAction(null);
    }
  };

  useEffect(() => {
    if (!selectedCategory) return;

    const loadWords = async () => {
      const response = await getApiClient().get(
        `/api/vocabulary/categories/${selectedCategory.id}/words`,
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
    <AppShell
      title="Vocabulary Library"
      description={
        isLoading
          ? "Loading your assessed vocabulary…"
          : `${categories.filter((category) => Number(category.word_count) > 0).length} active categories. Browse ChatGPT-generated lessons and their contextual meanings.`
      }
    >
      <section className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Starter set
            </p>
            <h2 className="mt-1 font-semibold text-slate-950">
              Preview the complete learning experience
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Four removable examples cover B2–C2 words, expressions,
              collocations and idioms. They belong only to your account.
            </p>
          </div>
          {starterSamples.loaded ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={loadSamples}
                disabled={sampleAction !== null}
                className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
              >
                {sampleAction === "loading"
                  ? "Refreshing…"
                  : starterSamples.outdated
                    ? `Update ${starterSamples.outdated} samples`
                    : "Refresh samples"}
              </button>
              <button
                type="button"
                onClick={removeSamples}
                disabled={sampleAction !== null}
                className="rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
              >
                {sampleAction === "removing"
                  ? "Removing…"
                  : `Remove samples (${starterSamples.loaded})`}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={loadSamples}
              disabled={sampleAction !== null}
              className="shrink-0 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
            >
              {sampleAction === "loading"
                ? "Loading…"
                : `Load ${starterSamples.available || 4} samples`}
            </button>
          )}
        </div>
        {sampleError && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {sampleError}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-2">
          {categories
            .filter((category) => Number(category.word_count) > 0)
            .map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  selectedCategory?.id === category.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: category.color_code || "#2563eb",
                    }}
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    {category.category_name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {category.track_name} · {category.word_count} words
                  {category.cefr_range ? ` · ${category.cefr_range}` : ""}
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
                      href={`/vocabulary/words/${word.id}?from=category&categoryId=${selectedCategory.id}&page=1&limit=50`}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-gray-900">
                          {word.word}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {word.word_type || "Word"} · {word.cefr_level}
                          {word.is_starter_sample ? " · Starter sample" : ""}
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
            <div className="py-10 text-center">
              <h2 className="font-semibold text-slate-950">
                No vocabulary entries yet
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
                Share text or a file with ChatGPT. Entries appear here only
                after assessment, exact-count review and approval.
              </p>
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
