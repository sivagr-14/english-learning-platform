"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

export default function CoveragePage() {
  const [target, setTarget] = useState("80000");
  const validTarget =
    Number.isInteger(Number(target)) &&
    Number(target) >= 400 &&
    Number(target) <= 200000;
  const [preparing, setPreparing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const running = useRef(false);
  useEffect(() => {
    getApiClient()
      .get("/api/fluency/coverage")
      .then((r) => setData(r.data))
      .catch(() =>
        setError("Could not load coverage. Check the backend and migrations."),
      );
    getApiClient()
      .get("/api/fluency/collections")
      .then((r) => setCollections(r.data.collections))
      .catch(() => setError("Could not load delivery packs."));
    return () => {
      running.current = false;
    };
  }, []);
  const download = (value: any, name: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const runAudit = async () => {
    if (running.current) return;
    running.current = true;
    setAuditing(true);
    setError("");
    const report: any = {
      startedAt: new Date().toISOString(),
      checked: 0,
      passedContract: 0,
      issues: [],
      complete: false,
      auditType: "automated-contract",
      semanticReview: "pending",
    };
    let after: string | undefined;
    try {
      do {
        const r = await getApiClient().get("/api/fluency/audit", {
          params: after ? { after } : {},
        });
        if (!running.current) break;
        report.checked += r.data.items.length;
        report.passedContract += r.data.items.filter(
          (x: any) => x.passed,
        ).length;
        report.issues.push(...r.data.items.filter((x: any) => !x.passed));
        after = r.data.next || undefined;
        report.complete = !after;
        setAudit({ ...report, issues: [...report.issues] });
      } while (after && running.current);
    } catch {
      setError(
        "Audit interrupted. Partial results are shown; restart to obtain a complete current audit.",
      );
    } finally {
      running.current = false;
      setAuditing(false);
    }
  };
  const prepare = async () => {
    if (!validTarget || preparing) return;
    setPreparing(true);
    setError("");
    try {
      const r = await getApiClient().post("/api/fluency/collection-request", {
        targetSenses: Number(target),
      });
      download(r.data, `${r.data.requestId}.json`);
    } catch {
      setError(
        "Could not prepare the collection request. Try again after checking the backend.",
      );
    } finally {
      setPreparing(false);
    }
  };
  const registerFile = async (file: File | undefined, review: boolean) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (review && !selectedCollection)
        throw new Error("Select a collection first.");
      await getApiClient().post(
        review
          ? `/api/fluency/collections/${selectedCollection}/reviews`
          : "/api/fluency/collections",
        payload,
      );
      const r = await getApiClient().get("/api/fluency/collections");
      setCollections(r.data.collections);
      setError("");
    } catch (e: any) {
      setError(
        e.response?.data?.message ||
          e.message ||
          "Could not register this file.",
      );
    }
  };
  const categories =
    data?.categories?.filter(
      (c: any) =>
        (!onlyEmpty || !c.entries) &&
        `${c.name} ${c.domain}`.toLowerCase().includes(filter.toLowerCase()),
    ) || [];
  return (
    <AuthenticatedPage>
      <AppShell
        title="Coverage & Collection"
        description="See the gaps across every category. Available content, quality checks and learned vocabulary are separate measures."
      >
        {error && (
          <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">
            {error}
          </p>
        )}
        {!data ? (
          <p>Loading coverage…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Available entries", data.totalEntries],
                ["Categories", data.categories.length],
                [
                  "Empty categories",
                  data.categories.filter((c: any) => !c.entries).length,
                ],
                [
                  "Planning target",
                  validTarget
                    ? `${Number(target).toLocaleString()} senses`
                    : "Enter a target",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded border bg-white p-4">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <section className="space-y-3 rounded-xl border bg-white p-5">
              <h2 className="text-xl font-semibold">
                Collection delivery plan
              </h2>
              <p>
                Plan for approximately{" "}
                {validTarget ? Math.ceil(Number(target) / 400) : "—"} visible
                packs of up to 400 entries. Each pack groups smaller validated
                units. Existing valid entries reduce the remaining work;
                candidates are selected for usefulness, never to fill a
                numerical quota.
              </p>
              <p>
                The target is a planning goal, not already-assessed packs.
                Freeze pack membership only after complete manifests pass
                validation. Same word + different meaning remains a separate
                entry.
              </p>
              <p className="text-sm text-slate-600">
                Professional communication means reasoning, trade-offs,
                principles, strategy, setbacks, expectations and tactful
                discussion—not a technical glossary.
              </p>
              <label className="block text-sm font-medium">
                Target senses (400–200,000)
                <input
                  type="number"
                  min={400}
                  max={200000}
                  step={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-invalid={!validTarget}
                  className="ml-3 w-40 rounded border p-2"
                />
              </label>
              {!validTarget && (
                <p role="alert">Enter a whole number from 400 to 200,000.</p>
              )}
              <p className="text-sm text-slate-600">
                40,000 is about 100 packs; 80,000 is about 200. Start with a
                reviewed 400-entry pilot. This setting changes new requests
                only.
              </p>
              <button
                disabled={!validTarget || preparing}
                className="rounded bg-blue-700 px-4 py-2 text-white"
                onClick={prepare}
              >
                {preparing
                  ? "Preparing request…"
                  : "Prepare collection request for ChatGPT"}
              </button>
              <p className="text-sm">
                Attach the downloaded request in ChatGPT. It includes current
                matching vocabulary and taxonomy, not database credentials.
                Generation still requires complete assessment and validated
                manifests.
              </p>
            </section>
            <section className="space-y-3 rounded-xl border bg-white p-5">
              <h2 className="text-xl font-semibold">
                Registered delivery packs
              </h2>
              <p>
                Register the immutable collection index produced after manifest
                validation. Completion also requires an editorial review record
                for every candidate and database read-back verification.
              </p>
              <label className="block">
                Collection index{" "}
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => registerFile(e.target.files?.[0], false)}
                />
              </label>
              {collections.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <label>
                    Collection{" "}
                    <select
                      className="rounded border p-2"
                      value={selectedCollection}
                      onChange={(e) => setSelectedCollection(e.target.value)}
                    >
                      <option value="">Select collection</option>
                      {collections.map((c) => (
                        <option key={c.collectionId} value={c.collectionId}>
                          {c.collectionId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Editorial review record{" "}
                    <input
                      disabled={!selectedCollection}
                      type="file"
                      accept=".json"
                      onChange={(e) => registerFile(e.target.files?.[0], true)}
                    />
                  </label>
                </div>
              )}
              {!collections.length && (
                <p>No frozen delivery packs registered yet.</p>
              )}
              {collections.map((c) => (
                <details key={c.collectionId}>
                  <summary className="cursor-pointer font-semibold">
                    {c.collectionId}:{" "}
                    {c.packs.filter((p: any) => p.complete).length}/
                    {c.packs.length} packs complete · {c.entryCount} planned
                    senses
                  </summary>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {c.packs.map((p: any) => (
                      <li className="rounded border p-3" key={p.packId}>
                        {p.packId} · {p.entryCount} entries ·{" "}
                        {p.complete
                          ? "Verified with review records"
                          : `${p.missingUnits.length} units awaiting delivery, verification or review`}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
            <section className="space-y-3 rounded-xl border bg-white p-5">
              <h2 className="text-xl font-semibold">Audit existing lessons</h2>
              <p>{data.notice}</p>
              <p className="text-sm">
                This audit checks the lesson contract and sense identity. It
                does not certify frequency, naturalness, source provenance, or
                semantic uniqueness.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={auditing}
                  className="rounded border px-4 py-2 disabled:opacity-50"
                  onClick={runAudit}
                >
                  Run contract audit
                </button>
                {auditing && (
                  <button
                    className="rounded border px-4 py-2"
                    onClick={() => {
                      running.current = false;
                    }}
                  >
                    Stop after this page
                  </button>
                )}
                {audit && (
                  <button
                    className="rounded border px-4 py-2"
                    onClick={() =>
                      download(audit, "vocabulary-contract-audit.json")
                    }
                  >
                    Download audit
                  </button>
                )}
              </div>
              {audit && (
                <p role="status">
                  {audit.checked} checked · {audit.passedContract} passed
                  automated contract · {audit.issues.length} need attention ·{" "}
                  {audit.complete ? "Audit completed" : "Partial audit"}.
                  Language review remains separate.
                </p>
              )}
            </section>
            <div className="flex flex-wrap gap-4">
              <label>
                Find category{" "}
                <input
                  className="rounded border p-2"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <label className="p-2">
                <input
                  type="checkbox"
                  checked={onlyEmpty}
                  onChange={(e) => setOnlyEmpty(e.target.checked)}
                />{" "}
                Empty categories only
              </label>
            </div>
            <div className="overflow-x-auto rounded border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {[
                      "Category",
                      "Domain",
                      "Entries",
                      "Current format",
                      "Levels",
                    ].map((h) => (
                      <th className="p-3" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c: any) => (
                    <tr key={c.key} className="border-t">
                      <td className="p-3">
                        <Link
                          className="text-blue-700 underline"
                          href={`/taxonomy/${c.key}`}
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="p-3">{c.domain.replaceAll("_", " ")}</td>
                      <td className="p-3">{c.entries}</td>
                      <td className="p-3">{c.currentFormat}</td>
                      <td className="p-3">
                        {Object.entries(c.levels)
                          .map(([level, count]) => `${level}: ${count}`)
                          .join(" · ") || "No entries"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AppShell>
    </AuthenticatedPage>
  );
}
