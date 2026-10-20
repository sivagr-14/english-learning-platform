'use client';

import { useEffect } from 'react';
import { initializeApiClient } from '@/lib/api/client';
import useAuthStore from '@/lib/store/auth';
import LearningPreferencesController from '@/components/LearningPreferencesController';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initializeApiClient();
    useAuthStore.getState().loadFromLocalStorage();
  }, []);

  return <><LearningPreferencesController />{children}</>;
}

