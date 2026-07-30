"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";
import AppShell from "@/components/AppShell";

interface RecallCategory {
  id: string;
  track_name: string;
  category_name: string;
  difficulty_level: string;
  color_code: string | null;
  due_count: string | number;
}

interface Card {
  id: string;
  word: string;
  pronunciation: string | null;
  word_type: string | null;
  cefr_level: string;
  frequency: string;
  english_meaning: string;
  tamil_meaning: string;
  core_idea: string;
  track_name: string;
  category_name: string;
  proficiency_level: number;
  times_reviewed: number;
  next_review_at: string;
  lesson_data?: any;
}

const ratings = [
  { id: "again", label: "Again", tone: "bg-red-600 hover:bg-red-700" },
  { id: "hard", label: "Hard", tone: "bg-amber-600 hover:bg-amber-700" },
  { id: "good", label: "Good", tone: "bg-blue-600 hover:bg-blue-700" },
  { id: "easy", label: "Easy", tone: "bg-green-600 hover:bg-green-700" },
] as const;

export default function FlashcardsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [categories, setCategories] = useState<RecallCategory[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<RecallCategory | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

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
      setIsLoadingCategories(true);
      const response = await getApiClient().get("/api/flashcards/categories");
      setCategories(response.data.categories);
      setSelectedCategory(null);
      setCards([]);
      setIndex(0);
      setShowAnswer(false);
      setIsLoadingCategories(false);
    };

    loadCategories().catch(() => setIsLoadingCategories(false));
  }, [isHydrated, isAuthenticated]);

  const loadCards = async (category: RecallCategory) => {
    setSelectedCategory(category);
    setIsLoadingCards(true);
    setCards([]);
    setIndex(0);
    setShowAnswer(false);

    try {
      const response = await getApiClient().get("/api/flashcards/due", {
        params: { categoryId: category.id },
      });
      setCards(response.data.cards);
    } finally {
      setIsLoadingCards(false);
    }
  };

  const card = cards[index];

  const review = async (rating: (typeof ratings)[number]["id"]) => {
    if (!card) return;

    await getApiClient().post(`/api/flashcards/${card.id}/review`, {
      rating,
    });

    const nextCards = cards.filter((_, cardIndex) => cardIndex !== index);
    setCards(nextCards);
    setIndex(Math.min(index, Math.max(0, nextCards.length - 1)));
    setShowAnswer(false);

    if (selectedCategory && nextCards.length === 0) {
      setCategories((current) =>
        current.filter((category) => category.id !== selectedCategory.id),
      );
    }
  };

  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <AppShell
      title="Spaced Review"
      description={
        selectedCategory
          ? `${selectedCategory.category_name} · ${cards.length} due`
          : "Choose one category and recall each answer before revealing it."
      }
    >
      {!selectedCategory ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Select Recall Category
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Recall stays focused on one category at a time.
          </p>

          {isLoadingCategories ? (
            <div className="mt-6 rounded-lg bg-gray-50 p-6 text-sm text-gray-600">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="mt-6 rounded-lg bg-gray-50 p-6 text-sm text-gray-600">
              No cards are due now.
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => loadCards(category)}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">
                        {category.track_name} · {category.difficulty_level}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-gray-900">
                        {category.category_name}
                      </h3>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-sm font-medium text-white"
                      style={{
                        backgroundColor: category.color_code || "#2563eb",
                      }}
                    >
                      {category.due_count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setCards([]);
              setIndex(0);
              setShowAnswer(false);
            }}
            className="mb-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Change Category
          </button>

          {isLoadingCards ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-600">
              Loading recall cards...
            </div>
          ) : !card ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900">
                No cards due in this category
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Pick another category or come back after the next review time.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {card.track_name} / {card.category_name} · {card.cefr_level}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900">
                    {showAnswer
                      ? card.word
                      : "Recall the English word or expression"}
                  </h2>
                  {showAnswer && (
                    <p className="mt-1 text-sm text-gray-600">
                      {card.pronunciation} · {card.word_type}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  {card.frequency}
                </span>
              </div>

              {!showAnswer ? (
                <div className="mt-8">
                  <div className="rounded-xl bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Your prompt
                    </p>
                    {card.tamil_meaning && (
                      <p className="mt-3 text-lg font-medium text-blue-800">
                        {card.tamil_meaning}
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {card.core_idea || card.english_meaning}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
                    className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Reveal answer
                  </button>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <section>
                    <h3 className="text-sm font-semibold uppercase text-gray-500">
                      Meaning
                    </h3>
                    <p className="mt-2 text-gray-800">{card.english_meaning}</p>
                    <p className="mt-1 text-blue-700">{card.tamil_meaning}</p>
                    <p className="mt-2 text-sm text-gray-600">
                      {card.core_idea}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold uppercase text-gray-500">
                      Recall
                    </h3>
                    <p className="mt-2 text-gray-800">
                      {card.lesson_data?.memory_mastery?.recall_question}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {card.lesson_data?.memory_mastery?.memory_sentence}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold uppercase text-gray-500">
                      Natural Use
                    </h3>
                    <p className="mt-2 text-gray-800">
                      {card.lesson_data?.usage_mastery?.when_to_use?.[0]}
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                      {card.lesson_data?.usage_mastery?.when_not_to_use?.[0]}
                    </p>
                  </section>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {ratings.map((rating) => (
                      <button
                        key={rating.id}
                        type="button"
                        onClick={() => review(rating.id)}
                        className={`rounded-lg px-4 py-3 text-sm font-medium text-white ${rating.tone}`}
                      >
                        {rating.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
