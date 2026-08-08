"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import AuthenticatedPage from "@/components/AuthenticatedPage";
import { getApiClient } from "@/lib/api/client";

export default function CandidateReviewPage() {
  const [jobs, setJobs] = useState<any[]>([]),
    [jobId, setJobId] = useState("");
  const [data, setData] = useState<any>({ candidates: [], unresolved: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState(""),
    [reason, setReason] = useState("Reviewed in candidate workspace");
  const [error, setError] = useState("");
  const loadJobs = useCallback(async () => {
    const r = await getApiClient().get("/api/generation/jobs");
    setJobs(r.data.jobs);
    if (!jobId && r.data.jobs[0]) setJobId(r.data.jobs[0].id);
  }, [jobId]);
  const load = useCallback(async () => {
    if (!jobId) return;
    const r = await getApiClient().get(
      `/api/generation/jobs/${jobId}/candidates`,
    );
    setData(r.data);
  }, [jobId]);
  useEffect(() => {
    void loadJobs().catch(() => setError("Could not load jobs."));
  }, [loadJobs]);
  useEffect(() => {
    void load().catch(() => setError("Could not load candidates."));
    setSelected(new Set());
  }, [load]);
  const visible = useMemo(
    () =>
      data.candidates.filter(
        (c: any) =>
          !filter || c.decision === filter || c.review_status === filter,
      ),
    [data, filter],
  );
  async function act(action: string) {
    if (!selected.size) return setError("Select at least one candidate.");
    try {
      await getApiClient().post(
        `/api/generation/jobs/${jobId}/candidates/review`,
        { candidateIds: [...selected], action, patch: {}, reason },
      );
      setSelected(new Set());
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Review action failed.",
      );
    }
  }
  async function resume() {
    try {
      await getApiClient().post(`/api/generation/jobs/${jobId}/resume`);
      await loadJobs();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Could not resume generation.");
    }
  }
  return (
    <AuthenticatedPage>
      <AppShell
        title="Candidate review"
        description="Inspect decisions, source evidence, sense matching, taxonomy confidence, and auditable exceptions before completion."
      >
        <div className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
            <select
              aria-label="Generation job"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="rounded border p-2 text-sm"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.source_name} — {j.status}
                </option>
              ))}
            </select>
            <select
              aria-label="Candidate filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded border p-2 text-sm"
            >
              <option value="">All candidates</option>
              <option value="generate">Generate</option>
              <option value="existing">Existing</option>
              <option value="filtered">Filtered</option>
              <option value="rejected">Rejected</option>
              <option value="attention_required">Attention required</option>
              <option value="approved">Approved</option>
            </select>
            <input
              aria-label="Audit reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-w-72 flex-1 rounded border p-2 text-sm"
            />
            {(["approve", "reject", "retry"] as const).map((a) => (
              <button
                key={a}
                onClick={() => void act(a)}
                className="rounded bg-slate-800 px-3 py-2 text-sm font-medium capitalize text-white"
              >
                {a}
              </button>
            ))}
            <button
              onClick={() => void resume()}
              disabled={data.completionBlocked}
              className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Resume generation
            </button>
          </div>
          {data.completionBlocked && (
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
              Completion blocked: {data.unresolved} attention item(s) remain
              unresolved.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  {[
                    "",
                    "Candidate",
                    "Decision",
                    "Meaning / evidence",
                    "Sense",
                    "Level / frequency",
                    "Taxonomy",
                    "Confidence / reason",
                    "Occurrences",
                    "Audit",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c: any) => {
                  const s = c.snapshot || {},
                    t = s.taxonomy || {};
                  return (
                    <tr key={c.id} className="border-t align-top">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${s.term || c.normalized_term}`}
                          checked={selected.has(c.id)}
                          onChange={() =>
                            setSelected((x) => {
                              const n = new Set(x);
                              n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="p-3 font-medium">
                        {s.term || c.normalized_term}
                        <div className="text-xs text-slate-500">
                          {s.itemType}
                        </div>
                      </td>
                      <td className="p-3">{c.decision}</td>
                      <td className="max-w-xs p-3">
                        {s.contextualMeaning}
                        <div className="mt-1 text-xs text-slate-500">
                          {s.senseEvidence?.sentence ||
                            c.occurrences?.[0]?.sentence}
                        </div>
                      </td>
                      <td className="p-3">{s.senseDecision}</td>
                      <td className="p-3">
                        {s.cefrLevel} · {s.usageFrequency}
                      </td>
                      <td className="p-3 text-xs">
                        {t.domainKey}
                        <br />
                        {t.usageGroupKey}
                        <br />
                        {t.categoryKey}
                      </td>
                      <td className="p-3">
                        {t.confidence}
                        <div className="text-xs text-slate-500">
                          {t.reason || c.reason}
                        </div>
                      </td>
                      <td className="p-3">{c.occurrences?.length || 0}</td>
                      <td className="p-3">
                        v{c.review_version} · {c.review_status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    </AuthenticatedPage>
  );
}
