"use client";
import { useEffect } from "react";
import useAuthStore from "@/lib/store/auth";
import useLearningPreferences, { useActivePreferences } from "@/lib/store/learning-preferences";

export default function LearningPreferencesController() {
  const userId = useAuthStore(state => state.user?.id);
  const preferences = useActivePreferences();
  useEffect(() => {
    if (userId) void useLearningPreferences.getState().load(userId);
    else useLearningPreferences.getState().reset();
    return () => useLearningPreferences.getState().reset();
  }, [userId]);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.showTamil = String(preferences.show_tamil);
    return () => { delete document.documentElement.dataset.theme; delete document.documentElement.dataset.showTamil; };
  }, [preferences]);
  return null;
}
