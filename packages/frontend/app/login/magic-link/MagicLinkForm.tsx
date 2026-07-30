'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/lib/api/auth';
import { MagicLinkSchema, type MagicLinkFormData } from '@/lib/schemas/auth';
import Link from 'next/link';

export function MagicLinkForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(MagicLinkSchema),
  });

  const onSubmit = async (data: MagicLinkFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      await authApi.sendMagicLink(data);
      setIsSuccess(true);
      setSentEmail(data.email);
      reset();
    } catch (error) {
      const errorMessage = (error as any)?.response?.data?.message || 'Failed to send magic link. Please try again.';
      setServerError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">Check your email!</h3>
          <p className="text-green-700 text-sm mb-4">
            We&apos;ve sent a sign-in link to{' '}
            <span className="font-semibold">{sentEmail}</span>
          </p>
          <p className="text-green-600 text-sm">
            The link will expire in 15 minutes. If you don&apos;t see it, check your spam folder.
          </p>
        </div>

        <button
          onClick={() => setIsSuccess(false)}
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          Send another link
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {serverError}
        </div>
      )}

      <p className="text-gray-600 text-sm">
        Enter your email address and we&apos;ll send you a sign-in link.
      </p>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
      >
        {isLoading ? 'Sending link...' : 'Send sign-in link'}
      </button>

      <div className="text-center text-sm text-gray-600">
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Back to login
        </Link>
      </div>
    </form>
  );
}
