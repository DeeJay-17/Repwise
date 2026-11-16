import { errorFrom, serviceUrl } from './config';
import type { components } from './core-api.generated';

export type TokenResponse = components['schemas']['TokenResponse'];
export type AccountUser = components['schemas']['User'];
export type SyncRequest = components['schemas']['SyncRequest'];
export type SyncResponse = components['schemas']['SyncResponse'];
export type SyncChange = components['schemas']['Change'];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Base URL of the core API (local port 8001 in development). See serviceUrl. */
export function coreApiUrl(): string {
  return serviceUrl(process.env.EXPO_PUBLIC_CORE_API_URL, 'coreApiUrl', 8001);
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${coreApiUrl()}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Repwise server. Check your connection.');
  }
  if (!response.ok) {
    const err = await errorFrom(response);
    throw new ApiError(response.status, err.code, err.message);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const coreApi = {
  signInWithGoogle: (idToken: string) =>
    call<TokenResponse>('/v1/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  refresh: (refreshToken: string) =>
    call<TokenResponse>('/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  logout: (refreshToken: string) =>
    call<void>('/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  deleteAccount: (token: string) => call<void>('/v1/me', { method: 'DELETE', token }),
  sync: (token: string, body: SyncRequest) =>
    call<SyncResponse>('/v1/sync', { method: 'POST', body: JSON.stringify(body), token }),
};
