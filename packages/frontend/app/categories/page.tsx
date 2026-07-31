"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

interface Category {
  id: string;
  track_name: string;
  category_name: string;
  description: string | null;
  color_code: string | null;
  word_count: string;
  cefr_range: string | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getApiClient()
      .get("/api/vocabulary/categories")
      .then((response) => setCategories(response.data.categories))
      .catch(() => setError("Could not load your vocabulary categories."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthenticatedPage>
      <AppShell
        title="Categories"
        description="Choose a category to see every linked word. CEFR ranges are calculated from the words inside each category."
      >
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            Loading categories…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error}
          </div>
        ) : !categories.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="font-semibold text-slate-950">
              No populated categories yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Categories appear here after approved vocabulary is added.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: category.color_code || "#2563eb",
                    }}
                  />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-950">
                      {category.category_name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {category.track_name}
                    </p>
                  </div>
                </div>
                {category.description && (
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                    {category.description}
                  </p>
                )}
                <p className="mt-4 text-sm font-medium text-blue-700">
                  {category.word_count} words
                  {category.cefr_range ? ` · ${category.cefr_range}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </AppShell>
    </AuthenticatedPage>
  );
}
