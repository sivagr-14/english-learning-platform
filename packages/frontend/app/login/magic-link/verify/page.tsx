"use client";
import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import MagicLinkVerify from "./MagicLinkVerify";
export default function MagicLinkVerifyPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Sign-in link"
          description="Verifying your sign-in link…"
        >
          <p role="status" className="mt-6">
            Please wait.
          </p>
        </AuthShell>
      }
    >
      <MagicLinkVerify />
    </Suspense>
  );
}
