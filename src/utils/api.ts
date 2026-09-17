/**
 * Resilient API Fetch with automatic retry and backoff.
 * Handles transient network dropouts (e.g. dev server restarts or container wakeups).
 */

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { retries = 3, retryDelay = 350, ...fetchOptions } = options;

  // Automatically attach auth token if available and not already provided
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    const token = localStorage.getItem('nash_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  fetchOptions.headers = headers;

  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      return response;
    } catch (err: any) {
      lastError = err;
      // If we still have retries left, wait and retry
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If all retries failed, log warning without throwing uncaught console errors
  console.warn(`[Network] apiFetch could not reach ${url}:`, lastError?.message || lastError);

  // Return a safe synthetic Response to prevent unhandled promise rejections
  return new Response(JSON.stringify({ error: lastError?.message || 'Network error' }), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function apiFetchJson<T = any>(url: string, options: FetchOptions = {}, fallback?: T): Promise<T | null> {
  try {
    const res = await apiFetch(url, options);
    if (res.ok) {
      return await res.json();
    }
    return fallback ?? null;
  } catch (err: any) {
    console.warn(`[Network] apiFetchJson error on ${url}:`, err?.message || err);
    return fallback ?? null;
  }
}
