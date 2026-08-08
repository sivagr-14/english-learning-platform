"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

const navigation = [
  { href: "/dashboard", label: "Home" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/categories", label: "Categories" },
  { href: "/search", label: "Search" },
  { href: "/flashcards", label: "Review" },
  { href: "/progress", label: "Progress" },
  { href: "/generate", label: "ChatGPT Imports" },
  { href: "/import", label: "Import (AI)" },
  { href: "/candidate-review", label: "Candidate Review" },
];

export default function AppShell({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isRestarting, setIsRestarting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [appRevision, setAppRevision] = useState("");

  useEffect(() => {
    getApiClient()
      .get("/health")
      .then((response) => setAppRevision(response.data.revision || "unknown"))
      .catch(() => setAppRevision("unknown"));
  }, []);

  const restartApp = async () => {
    const confirmed = window.confirm(
      "Restart the app to load recent code and content changes? Your vocabulary and review progress will be preserved.",
    );
    if (!confirmed) return;

    setIsRestarting(true);
    try {
      const response = await fetch("/__control/restart", {
        method: "POST",
        headers: { "x-english-mastery-control": "1" },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error || "The restart request was not accepted.",
        );
      }
      window.location.assign(`/__control?restart=${Date.now()}`);
    } catch (error) {
      setIsRestarting(false);
      window.alert(
        error instanceof Error
          ? error.message
          : "The app could not be restarted.",
      );
    }
  };

  const updateAndRestart = async () => {
    const confirmed = window.confirm(
      "Download the latest GitHub main version, back up PostgreSQL, apply migrations, synchronize built-in entries and restart?",
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/__control/update-restart", {
        method: "POST",
        headers: { "x-english-mastery-control": "1" },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error || "The update request was not accepted.",
        );
      }
      window.location.assign(`/__control?update=${Date.now()}`);
    } catch (error) {
      setIsUpdating(false);
      window.alert(
        error instanceof Error
          ? error.message
          : "The app could not be updated.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-lg font-bold tracking-tight text-slate-950 hover:text-blue-700"
            >
              English Mastery
            </Link>
            {appRevision && (
              <span
                title="Installed GitHub commit"
                className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500"
              >
                {appRevision}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user?.first_name || user?.email}
            </span>
            <button
              type="button"
              onClick={updateAndRestart}
              disabled={isUpdating || isRestarting}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
            >
              {isUpdating ? "Updating…" : "Update & restart"}
            </button>
            <button
              type="button"
              onClick={restartApp}
              disabled={isRestarting || isUpdating}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
            >
              {isRestarting ? "Restarting…" : "Restart current"}
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8"
        >
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                  active
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
