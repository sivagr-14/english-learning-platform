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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  const loadCategories = useCallback(async () => {
    const response = await getApiClient().get("/api/vocabulary/categories");
    setCategories(response.data.categories);
  }, []);

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
        ) : !categories.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="font-semibold text-slate-950">No categories yet</h2>
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
                        {category.is_default ? "Default personal" : "Personal"}
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
      </AppShell>
    </AuthenticatedPage>
  );
}
