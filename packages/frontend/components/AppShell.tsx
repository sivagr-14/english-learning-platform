"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api/client";
import Icon from "./Icon";
import useAuthStore from "@/lib/store/auth";

const navigation = [
  {
    group: "Your learning",
    items: [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/practice", label: "Fluency Practice", icon: "speak" },
      { href: "/flashcards", label: "Spaced Review", icon: "review" },
      { href: "/progress", label: "Progress", icon: "chart" },
    ],
  },
  {
    group: "Explore",
    items: [
      { href: "/discover", label: "Discover", icon: "book" },
      { href: "/vocabulary", label: "Vocabulary", icon: "book" },
      { href: "/knowledge-map", label: "Knowledge Map", icon: "chart" },
      { href: "/categories", label: "Categories", icon: "grid" },
      { href: "/search", label: "Search", icon: "search" },
    ],
  },
  {
    group: "Your collection",
    items: [
      { href: "/coverage", label: "Coverage & Collection", icon: "chart" },
      { href: "/settings", label: "Learning settings", icon: "grid" },
      { href: "/generate", label: "ChatGPT Imports", icon: "upload" },
    ],
  },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (menuOpen) drawer.current?.showModal();
    else drawer.current?.close();
    const previous = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
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
    <div className={`app-frame wordup-shell ${pathname === "/dashboard" ? "is-home" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <dialog ref={drawer} className="app-sidebar" aria-label="Navigation menu" onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setMenuOpen(false); } }} onClose={() => { setMenuOpen(false); menuButton.current?.focus(); }} onCancel={() => setMenuOpen(false)}>
        <div className="brand-row">
          <Link
            href="/dashboard"
            className="brand"
            aria-label="Mastery Skills home"
          >
            <span className="brand-mark">
              <Icon name="book" />
            </span>
            <span>
              Mastery Skills<small>Make yourself understood.</small>
            </span>
          </Link>
          <button
            className="drawer-close"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
            <span className="sr-only">
              Close navigation
            </span>
          </button>
        </div>
        <nav
          id="app-navigation"
          aria-label="Primary navigation"
          className={`app-navigation ${menuOpen ? "is-open" : ""}`}
        >
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <p className="nav-caption">{group.group}</p>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`) ||
                  (item.href === "/categories" &&
                    pathname.startsWith("/taxonomy/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`nav-item ${active ? "is-active" : ""}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="sidebar-note">
            <span className="eyebrow">Small steps, lasting progress</span>
            <p>Recall a little. Say it your way. Come back tomorrow.</p>
          </div>
        </nav>
      </dialog>
      <div className="app-workspace">
        <header className="workspace-bar">
          <button ref={menuButton} className="shell-menu" aria-expanded={menuOpen} aria-haspopup="dialog" aria-controls="app-navigation" onClick={() => setMenuOpen(true)}><Icon name="menu" /><span className="sr-only">Open navigation</span></button>
          <Link href="/dashboard" className="workspace-label">Mastery Skills</Link>
          <div className="flex items-center gap-3">
            <Link href="/search" className="search-shortcut">
              <Icon name="search" />
              <span className="sr-only">Find an expression</span>
            </Link>
            <details className="account-menu">
              <summary>
                <span className="avatar" aria-hidden="true">
                  {(user?.first_name || user?.email || "L")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
                <span className="sr-only">Account</span>
              </summary>
              <div className="account-panel">
                <Link href="/settings" className="nav-item">Learning settings</Link>
                <p className="mb-4 break-words text-sm font-semibold">
                  {user?.first_name || user?.email || "Your account"}
                </p>
                <button
                  onClick={updateAndRestart}
                  disabled={isUpdating || isRestarting}
                >
                  {isUpdating ? "Updating…" : "Update & restart"}
                </button>
                <button
                  onClick={restartApp}
                  disabled={isRestarting || isUpdating}
                >
                  {isRestarting ? "Restarting…" : "Restart current"}
                </button>
                <button
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                >
                  Sign out
                </button>
                {appRevision && (
                  <p className="mt-3 break-all text-xs text-slate-500">
                    Installed version: {appRevision}
                  </p>
                )}
              </div>
            </details>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace-main">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              {description && <p className="page-description">{description}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
          </div>
          {children}
          <footer className="workspace-footer">
            Understand it. Make it yours. Use it in real life.
          </footer>
        </main>
      </div>
    </div>
  );
}

