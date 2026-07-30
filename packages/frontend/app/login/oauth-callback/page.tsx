"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/lib/store/auth";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');

    if (token && refreshToken) {
      (async () => {
        try {
          // set tokens in store so API client can use them
          useAuthStore.getState().setTokens(token, refreshToken);

          // fetch user profile
          const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!resp.ok) throw new Error('Failed to fetch user profile');

          const body = await resp.json();
          const user = body.user;

          useAuthStore.getState().login(user, token, refreshToken);
          router.push('/dashboard');
        } catch (err: any) {
          setError(err?.message || 'OAuth failed');
        }
      })();
      return;
    }

    setError('Missing tokens from OAuth callback');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {!error ? (
          <div>Signing you in…</div>
        ) : (
          <div className="text-red-600">Error: {error}</div>
        )}
      </div>
    </div>
  );
}
