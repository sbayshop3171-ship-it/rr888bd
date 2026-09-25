import { clearAuthStorage, readAccessToken } from '@/lib/supabase';

export type ApiResult<T> = {
  success?: boolean;
  ok?: boolean;
  message?: string;
  data?: T | null;
};

export async function apiRequest<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const token = readAccessToken();
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body != null && typeof init.body === 'string') {
    try {
      JSON.parse(init.body);
      headers.set('Content-Type', 'application/json');
    } catch {
      // leave as-is for non-JSON payloads
    }
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null;

  if (response.status === 401 || response.status === 403) {
    clearAuthStorage();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error((payload as { message?: string } | null)?.message || 'Your session has expired. Please log in again.');
  }

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message || 'Request failed';
    throw new Error(message);
  }

  return (payload as T) ?? (null as unknown as T);
}
