"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiClient } from "@/lib/api/client";
import useAuthStore from "@/lib/store/auth";

let automaticContentSyncStarted = false;

async function synchronizeChatGPTContent() {
  const fetched = await fetch("/__control/sync-content", {
    method: "POST",
    headers: { "x-english-mastery-control": "1" },
  });
  if (!fetched.ok) return;
  const transport = await fetched.json().catch(() => ({}));
  if (!transport.fetchedCommit) return;
  const response = await getApiClient().post(
    "/api/control/content-packs/process",
    { fetchedCommit: transport.fetchedCommit },
  );
  const verified = response.data?.cleanupEligible || [];
  if (!verified.length) return;
  const cleanup = new URLSearchParams();
  for (const manifestId of verified) cleanup.append("manifestId", manifestId);
  await fetch(`/__control/cleanup-content?${cleanup.toString()}`, {
    method: "POST",
    headers: { "x-english-mastery-control": "1" },
  });
}

export default function AuthenticatedPage({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.getState().loadFromLocalStorage();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isHydrated, router]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || automaticContentSyncStarted) return;
    automaticContentSyncStarted = true;
    void synchronizeChatGPTContent().catch(() => {
      // The imports page exposes actionable reconciliation. Background sync is
      // best-effort and must never block the authenticated workspace.
    });
  }, [isAuthenticated, isHydrated]);

  if (!isHydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading your workspace…
      </div>
    );
  }

  return <>{children}</>;
}
