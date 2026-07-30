'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import useAuthStore from '@/lib/store/auth';
import { RegisterSchema, type RegisterFormData } from '@/lib/schemas/auth';
import Link from 'next/link';

export function RegisterForm() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterSchema),
  });

  const password = watch('password');
  const _confirmPassword = watch('confirm_password');

  const getPasswordRequirements = () => {
    const requirements = [
      { label: 'At least 8 characters', met: password?.length >= 8 },
      { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(password || '') },
      { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(password || '') },
      { label: 'Number (0-9)', met: /[0-9]/.test(password || '') },
      { label: 'Special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password || '') },
    ];
    return requirements;
  };

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const { confirm_password: _cp, ...payload } = data;
      const response = await authApi.register(payload);
      login(response.user, response.token, response.refreshToken);
      router.push('/dashboard');
    } catch (error) {
      const errorMessage = (error as any)?.response?.data?.message || 'Registration failed. Please try again.';
      setServerError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordRequirements = getPasswordRequirements();
  const allRequirementsMet = passwordRequirements.every((req) => req.met);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <input
            id="first_name"
            type="text"
            placeholder="John"
            {...register('first_name')}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.first_name ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {errors.first_name && (
            <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            id="last_name"
            type="text"
            placeholder="Doe"
            {...register('last_name')}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.last_name ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {errors.last_name && (
            <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
          )}
        </div>
      </div>

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

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
        )}

        {password && (
          <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
            <ul className="space-y-1">
              {passwordRequirements.map((req, idx) => (
                <li key={idx} className="flex items-center text-xs text-gray-600">
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${
                      req.met ? 'bg-green-100' : 'bg-gray-200'
                    }`}
                  >
                    {req.met && <span className="text-green-600 font-bold">✓</span>}
                  </span>
                  {req.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          id="confirm_password"
          type="password"
          placeholder="••••••••"
          {...register('confirm_password')}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.confirm_password ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading}
        />
        {errors.confirm_password && (
          <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
        )}
        {_confirmPassword && password === _confirmPassword && (
          <p className="mt-1 text-sm text-green-600">✓ Passwords match</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !allRequirementsMet}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </button>

      <div className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </form>
  );
}
