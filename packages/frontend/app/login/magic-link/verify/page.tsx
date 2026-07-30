'use client';

import { Suspense } from 'react';
import MagicLinkVerify from './MagicLinkVerify';

export default function MagicLinkVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-8">English Mastery</h1>
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
                <p className="text-gray-600">Verifying your sign-in link...</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <MagicLinkVerify />
    </Suspense>
  );
}
