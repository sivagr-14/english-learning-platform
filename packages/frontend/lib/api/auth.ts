import { getApiClient } from './client';

export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string;
  };
  token: string;
  refreshToken: string;
}

export interface MagicLinkSendPayload {
  email: string;
}

export interface MagicLinkVerifyPayload {
  token: string;
}

export interface OAuthPayload {
  code: string;
}

export const authApi = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const client = getApiClient();
    const response = await client.post('/api/auth/register', payload);
    return response.data;
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const client = getApiClient();
    const response = await client.post('/api/auth/login', payload);
    return response.data;
  },

  getProfile: async () => {
    const client = getApiClient();
    const response = await client.get('/api/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    const client = getApiClient();
    await client.post('/api/auth/logout');
  },

  refreshToken: async (refreshToken: string) => {
    const client = getApiClient();
    const response = await client.post('/api/auth/refresh', { refreshToken });
    return response.data;
  },

  googleOAuth: async (payload: OAuthPayload): Promise<AuthResponse> => {
    const client = getApiClient();
    const response = await client.post('/api/auth/oauth/google', payload);
    return response.data;
  },

  githubOAuth: async (payload: OAuthPayload): Promise<AuthResponse> => {
    const client = getApiClient();
    const response = await client.post('/api/auth/oauth/github', payload);
    return response.data;
  },

  sendMagicLink: async (
    payload: MagicLinkSendPayload
  ): Promise<{ message: string; email: string }> => {
    const client = getApiClient();
    const response = await client.post('/api/auth/magic-link/send', payload);
    return response.data;
  },

  verifyMagicLink: async (
    payload: MagicLinkVerifyPayload
  ): Promise<AuthResponse> => {
    const client = getApiClient();
    const response = await client.post(
      '/api/auth/magic-link/verify',
      payload
    );
    return response.data;
  },
};
