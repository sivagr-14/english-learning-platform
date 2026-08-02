"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
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
  is_user_category: boolean;
  is_default: boolean;
}

interface TaxonomySpecificCategory {
  key: string;
  name: string;
  description: string;
  taxonomy_version: string;
  word_count: number;
}

interface TaxonomyUsageGroup {
  key: string;
  name: string;
  description: string;
  word_count: number;
  categories: TaxonomySpecificCategory[];
}

interface TaxonomyDomain {
  key: string;
  name: string;
  description: string;
  word_count: number;
  usage_groups: TaxonomyUsageGroup[];
}

interface TaxonomyResponse {
  domains: TaxonomyDomain[];
  counts: {
    domains: number;
    usage_groups: number;
    specific_categories: number;
  };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [taxonomyQuery, setTaxonomyQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  const loadCategories = useCallback(async () => {
    const [categoryResponse, taxonomyResponse] = await Promise.all([
      getApiClient().get("/api/vocabulary/categories"),
      getApiClient().get("/api/vocabulary/taxonomy"),
    ]);
    setCategories(categoryResponse.data.categories);
    setTaxonomy(taxonomyResponse.data);
  }, []);

  const normalizedQuery = taxonomyQuery.trim().toLowerCase();
  const visibleDomains =
    taxonomy?.domains
      .map((domain) => ({
        ...domain,
        usage_groups: domain.usage_groups
          .map((group) => ({
            ...group,
            categories: group.categories.filter((category) =>
              [domain.name, group.name, category.name, category.description]
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery),
            ),
          }))
          .filter((group) => group.categories.length > 0),
      }))
      .filter((domain) => domain.usage_groups.length > 0) || [];

  useEffect(() => {
    loadCategories()
      .catch(() => setError("Could not load your vocabulary categories."))
      .finally(() => setIsLoading(false));
  }, [loadCategories]);

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      setCreateError("Enter a category name.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreateMessage("");
    try {
      const response = await getApiClient().post(
        "/api/vocabulary/user-categories",
        {
          name,
          description: newCategoryDescription.trim() || undefined,
        },
      );
      await loadCategories();
      setNewCategoryName("");
      setNewCategoryDescription("");
      setShowCreateForm(false);
      setCreateMessage(
        `${response.data.category.category_name} was created and is ready for words.`,
      );
    } catch (requestError: any) {
      setCreateError(
        requestError?.response?.data?.message ||
          "Could not create the category.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AuthenticatedPage>
      <AppShell
        title="Categories"
        description="Create personal categories and choose any category to see its linked words."
        actions={
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setCreateError("");
              setCreateMessage("");
            }}
            className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {showCreateForm ? "Cancel" : "Create category"}
          </button>
        }
      >
        {showCreateForm && (
          <form
            onSubmit={createCategory}
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5"
          >
            <h2 className="font-semibold text-slate-950">
              Create a personal category
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              It will appear immediately in this page and in the category menu
              for individual or selected words.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr_auto] lg:items-end">
              <label className="text-sm font-medium text-slate-800">
                Category name
                <input
                  autoFocus
                  value={newCategoryName}
                  maxLength={100}
                  disabled={isCreating}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="For example: Travel phrases"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="text-sm font-medium text-slate-800">
                Description (optional)
                <input
                  value={newCategoryDescription}
                  maxLength={500}
                  disabled={isCreating}
                  onChange={(event) =>
                    setNewCategoryDescription(event.target.value)
                  }
                  placeholder="What you want to collect in this category"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <button
                type="submit"
                disabled={isCreating || !newCategoryName.trim()}
                className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create"}
              </button>
            </div>
            {createError && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                {createError}
              </p>
            )}
          </form>
        )}

        {createMessage && (
          <p
            role="status"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
          >
            {createMessage}
          </p>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            Loading categories…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            {error}
          </div>
        ) : !taxonomy ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
            The learning taxonomy is unavailable.
          </div>
        ) : (
          <>
            <section className="mb-10">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    Learning taxonomy
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {taxonomy.counts.domains} domains ·{" "}
                    {taxonomy.counts.usage_groups} usage groups ·{" "}
                    {taxonomy.counts.specific_categories} specific categories
                  </p>
                </div>
                <label className="text-sm font-medium text-slate-700">
                  Find a usage category
                  <input
                    value={taxonomyQuery}
                    onChange={(event) => setTaxonomyQuery(event.target.value)}
                    placeholder="Airport, pain, meetings…"
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 sm:w-72"
                  />
                </label>
              </div>
              <div className="space-y-3">
                {visibleDomains.map((domain) => (
                  <details
                    key={domain.key}
                    open={Boolean(normalizedQuery)}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <summary className="cursor-pointer font-semibold text-slate-950">
                      {domain.name}{" "}
                      <span className="font-normal text-slate-500">
                        · {domain.word_count} words
                      </span>
                    </summary>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      {domain.usage_groups.map((group) => (
                        <div
                          key={group.key}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-4"
                        >
                          <h3 className="font-semibold text-slate-900">
                            {group.name}{" "}
                            <span className="font-normal text-slate-500">
                              · {group.word_count}
                            </span>
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.categories.map((category) => (
                              <Link
                                key={category.key}
                                href={`/taxonomy/${category.key}`}
                                title={category.description}
                                className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50"
                              >
                                {category.name} · {category.word_count}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-slate-950">
                Personal and legacy categories
              </h2>
              {!categories.length ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <h2 className="font-semibold text-slate-950">
                    No categories yet
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Create your first personal category using the button above.
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
                          {category.is_user_category && (
                            <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              {category.is_default
                                ? "Default personal"
                                : "Personal"}
                            </span>
                          )}
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
            </section>
          </>
        )}
      </AppShell>
    </AuthenticatedPage>
  );
}
