"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="eyebrow">Let’s try that again</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        This page couldn’t open.
      </h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        Try loading it again, or return to your learning home.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn-secondary" href="/dashboard">
          Go to home
        </Link>
      </div>
    </main>
  );
}
