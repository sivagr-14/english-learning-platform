"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import PaginationControls, {
  PaginationState,
} from "@/components/PaginationControls";
import VocabularyWordList, {
  VocabularyWordSummary,
} from "@/components/VocabularyWordList";
import { getApiClient } from "@/lib/api/client";

interface Category {
  id: string;
  track_name: string;
  category_name: string;
  description: string | null;
  cefr_range: string | null;
  word_count: string;
}

function CategoryWordsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPage = Number(searchParams.get("page") || 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 50;
  const [category, setCategory] = useState<Category | null>(null);
  const [words, setWords] = useState<VocabularyWordSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");
    getApiClient()
      .get(`/api/vocabulary/categories/${params.id}/words`, {
        params: { page, limit },
      })
      .then((response) => {
        setCategory(response.data.category);
        setWords(response.data.words);
        setPagination(response.data.pagination);
      })
      .catch(() => setError("Could not load this category."))
      .finally(() => setIsLoading(false));
  }, [limit, page, params.id]);

  const openPage = (nextPage: number) => {
    router.push(`/categories/${params.id}?page=${nextPage}`);
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title={category?.category_name || "Category words"}
        description={
          category?.description || "Browse every word linked to this category."
        }
        actions={
          <Link
            href="/categories"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to categories
          </Link>
        }
      >
        {category && (
          <p className="mb-5 text-sm font-medium text-blue-700">
            {pagination?.total ?? category.word_count} words
            {category.cefr_range ? ` · ${category.cefr_range}` : ""}
          </p>
        )}
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            Loading words…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            <VocabularyWordList
              words={words}
              hrefForWord={(word) =>
                `/vocabulary/words/${word.id}?from=category&categoryId=${params.id}&page=${page}&limit=${limit}`
              }
              emptyMessage="This category does not contain any vocabulary yet."
            />
            {pagination && (
              <PaginationControls
                pagination={pagination}
                onPageChange={openPage}
              />
            )}
          </>
        )}
      </AppShell>
    </AuthenticatedPage>
  );
}

export default function CategoryWordsPage() {
  return (
    <Suspense fallback={null}>
      <CategoryWordsContent />
    </Suspense>
  );
}
