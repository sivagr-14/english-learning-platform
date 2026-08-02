"use client";

import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api/client";

interface Category {
  id: string;
  track_name: string;
  category_name: string;
  description: string | null;
  is_default: boolean;
  is_user_category: boolean;
  word_count: number;
}

const CREATE_NEW_VALUE = "__create_new__";

export default function WordCategoryPicker({
  wordIds,
  onUpdated,
}: {
  wordIds: string[];
  onUpdated?: () => void | Promise<void>;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCategories = async () => {
    const response = await getApiClient().get(
      "/api/vocabulary/categories?includeEmpty=true",
    );
    const nextCategories: Category[] = response.data.categories;
    setCategories(nextCategories);
    setSelectedCategoryId((current) => {
      if (current && current !== CREATE_NEW_VALUE) {
        const stillExists = nextCategories.some(
          (category) => category.id === current,
        );
        if (stillExists) return current;
      }
      return (
        nextCategories.find(
          (category) => category.is_user_category && category.is_default,
        )?.id ||
        nextCategories[0]?.id ||
        ""
      );
    });
  };

  useEffect(() => {
    loadCategories()
      .catch(() => setError("Could not load the available categories."))
      .finally(() => setIsLoading(false));
  }, []);

  const addToCategory = async () => {
    if (!wordIds.length || !selectedCategoryId) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      let categoryNameToCreate: string | undefined;

      if (selectedCategoryId === CREATE_NEW_VALUE) {
        const name = newCategoryName.trim();
        if (!name) {
          setError("Enter a name for the new category.");
          return;
        }
        categoryNameToCreate = name;
      }

      const response = await getApiClient().post(
        "/api/vocabulary/words/categories",
        selectedCategoryId === CREATE_NEW_VALUE
          ? { wordIds, newCategoryName: categoryNameToCreate }
          : { wordIds, categoryId: selectedCategoryId },
      );
      const {
        added,
        already_present: alreadyPresent,
        category,
      } = response.data;
      const categoryName = category.category_name;
      if (selectedCategoryId === CREATE_NEW_VALUE) {
        setNewCategoryName("");
        setSelectedCategoryId(category.id);
      }
      const parts = [
        added
          ? `${added} ${added === 1 ? "word" : "words"} added to ${categoryName}.`
          : `All selected words are already in ${categoryName}.`,
      ];
      if (alreadyPresent && added) {
        parts.push(`${alreadyPresent} already there.`);
      }
      setMessage(parts.join(" "));
      await loadCategories();
      await onUpdated?.();
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          "Could not add the selected words to this category.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1 text-sm font-medium text-slate-800">
          Add {wordIds.length === 1 ? "word" : "selected words"} to
          <select
            value={selectedCategoryId}
            disabled={isLoading || isSaving}
            onChange={(event) => {
              setSelectedCategoryId(event.target.value);
              setMessage("");
              setError("");
            }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {isLoading && <option value="">Loading categories…</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.is_user_category
                  ? "My Categories"
                  : category.track_name}
                {" — "}
                {category.category_name}
                {category.is_default ? " (default)" : ""}
                {Number(category.word_count) === 0 ? " (empty)" : ""}
              </option>
            ))}
            <option value={CREATE_NEW_VALUE}>Create new category…</option>
          </select>
        </label>

        {selectedCategoryId === CREATE_NEW_VALUE && (
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-800">
            New category name
            <input
              value={newCategoryName}
              maxLength={100}
              disabled={isSaving}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="For example: Travel phrases"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
        )}

        <button
          type="button"
          disabled={
            isLoading || isSaving || !wordIds.length || !selectedCategoryId
          }
          onClick={addToCategory}
          className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving
            ? "Adding…"
            : wordIds.length
              ? `Add ${wordIds.length} ${wordIds.length === 1 ? "word" : "words"}`
              : "Select word(s) first"}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        Every available category is shown. Adding is additive, so existing
        category links stay unchanged.
      </p>
      {message && (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
