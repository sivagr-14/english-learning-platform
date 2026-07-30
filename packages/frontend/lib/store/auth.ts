import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  current_level?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setTokens: (token, refreshToken) => {
    set({ token, refreshToken, isAuthenticated: true });
    get().saveToLocalStorage();
  },

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  login: (user, token, refreshToken) => {
    set({
      user,
      token,
      refreshToken,
      isAuthenticated: true,
      error: null,
    });
    get().saveToLocalStorage();
  },

  logout: () => {
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
    localStorage.removeItem('authStore');
  },

  loadFromLocalStorage: () => {
    const stored = localStorage.getItem('authStore');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        set({
          user: parsed.user,
          token: parsed.token,
          refreshToken: parsed.refreshToken,
          isAuthenticated: !!parsed.token,
        });
      } catch (error) {
        console.error('Failed to load auth state:', error);
      }
    }
  },

  saveToLocalStorage: () => {
    const { user, token, refreshToken } = get();
    if (token && refreshToken) {
      localStorage.setItem(
        'authStore',
        JSON.stringify({ user, token, refreshToken })
      );
    }
  },
}));

export default useAuthStore;
