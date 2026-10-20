"use client";
import { create } from "zustand";
import useAuthStore from "./auth";
import { getApiClient } from "@/lib/api/client";

export type LearningPreferences = {
  accent: "en-GB" | "en-US";
  show_tamil: boolean;
  theme: "light" | "dark";
};
export const defaultPreferences: LearningPreferences = { accent: "en-GB", show_tamil: true, theme: "light" };
type State = {
  userId: string | null;
  preferences: LearningPreferences;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  load: (userId: string) => Promise<void>;
  save: (preferences: LearningPreferences) => Promise<boolean>;
  reset: () => void;
};
let generation = 0;
const useLearningPreferences = create<State>((set, get) => ({
  userId: null, preferences: defaultPreferences, loaded: false, loading: false, saving: false, error: "",
  reset: () => { generation++; set({ userId: null, preferences: defaultPreferences, loaded: false, loading: false, saving: false, error: "" }); },
  load: async (userId) => {
    const request = ++generation;
    set({ userId, preferences: defaultPreferences, loaded: false, loading: true, saving: false, error: "" });
    try {
      const { data } = await getApiClient().get("/api/vocabulary/learning-preferences");
      if (request === generation && useAuthStore.getState().user?.id === userId)
        set({ loaded: true, preferences: { accent: data.preferences.accent, show_tamil: data.preferences.show_tamil, theme: data.preferences.theme } });
    } catch {
      if (request === generation) set({ error: "Could not load your settings. Retry before saving." });
    } finally { if (request === generation) set({ loading: false }); }
  },
  save: async (preferences) => {
    const { userId, saving, loading, loaded } = get();
    if (!userId || saving || loading || !loaded || useAuthStore.getState().user?.id !== userId) return false;
    const request = ++generation;
    set({ saving: true, error: "" });
    try {
      const { data } = await getApiClient().put("/api/vocabulary/learning-preferences", preferences);
      if (request !== generation || useAuthStore.getState().user?.id !== userId) return false;
      set({ loaded: true, preferences: { accent: data.preferences.accent, show_tamil: data.preferences.show_tamil, theme: data.preferences.theme } });
      return true;
    } catch {
      if (request === generation) set({ error: "Your settings were not saved. Your previous settings are still active." });
      return false;
    } finally { if (request === generation) set({ saving: false }); }
  },
}));
export function useActivePreferences() {
  const userId = useAuthStore(state => state.user?.id);
  return useLearningPreferences(state => state.userId === userId ? state.preferences : defaultPreferences);
}
export default useLearningPreferences;
