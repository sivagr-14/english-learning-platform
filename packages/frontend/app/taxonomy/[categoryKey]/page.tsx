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

interface TaxonomyCategory {
  key: string;
  name: string;
  description: string;
  taxonomy_version: string;
  domain_key: string;
  domain_name: string;
  usage_group_key: string;
  usage_group_name: string;
}

function TaxonomyWordsContent() {
  const params = useParams<{ categoryKey: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPage = Number(searchParams.get("page") || 1);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 50;
  const [category, setCategory] = useState<TaxonomyCategory | null>(null);
  const [words, setWords] = useState<VocabularyWordSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");
    getApiClient()
      .get(
        `/api/vocabulary/taxonomy/${encodeURIComponent(params.categoryKey)}/words`,
        { params: { page, limit } },
      )
      .then((response) => {
        setCategory(response.data.category);
        setWords(response.data.words);
        setPagination(response.data.pagination);
      })
      .catch(() => setError("Could not load this taxonomy category."))
      .finally(() => setIsLoading(false));
  }, [limit, page, params.categoryKey]);

  const openPage = (nextPage: number) => {
    router.push(`/taxonomy/${params.categoryKey}?page=${nextPage}`);
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title={category?.name || "Learning category"}
        description={
          category
            ? `${category.domain_name} → ${category.usage_group_name} → ${category.name}`
            : "Browse words assigned to this specific usage pattern."
        }
        actions={
          <Link
            href="/categories"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back to taxonomy
          </Link>
        }
      >
        {category && (
          <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              {category.domain_name} → {category.usage_group_name} →{" "}
              {category.name}
            </p>
            <p className="mt-1 text-sm text-blue-800">
              {category.description} · Taxonomy {category.taxonomy_version}
            </p>
          </div>
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
              hrefForWord={(word) => `/vocabulary/words/${word.id}`}
              emptyMessage="No words have been assigned to this specific usage category yet."
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

export default function TaxonomyWordsPage() {
  return (
    <Suspense fallback={null}>
      <TaxonomyWordsContent />
    </Suspense>
  );
}
