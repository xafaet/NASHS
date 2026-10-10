/**
 * Resilient API Fetch with automatic retry and backoff.
 * Handles transient network dropouts (e.g. dev server restarts or container wakeups).
 * Prevents HTML fallback response parsing crashes ("Unexpected token '<' is not valid JSON").
 */

// Global safety shield: prevents any unhandled Response.json() call from throwing
// "SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON"
if (typeof Response !== 'undefined' && !(Response.prototype as any).__safePatched) {
  (Response.prototype as any).__safePatched = true;
  Response.prototype.json = async function () {
    try {
      const text = await this.text();
      const trimmed = text ? text.trim() : '';
      if (!trimmed) {
        return {};
      }
      if (
        trimmed.startsWith('<') ||
        trimmed.startsWith('<!doctype') ||
        trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<html') ||
        trimmed.startsWith('<HTML')
      ) {
        console.warn(`[SafeJSON] Intercepted HTML response parsed as JSON from ${this.url || 'endpoint'}`);
        return {};
      }
      return JSON.parse(text);
    } catch (err: any) {
      console.warn('[SafeJSON] Handled invalid JSON parse safely:', err?.message || err);
      return {};
    }
  };
}

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

/**
 * Safely parse JSON from any Response object. If response is HTML, non-JSON or invalid,
 * returns null or the optional fallback instead of throwing a SyntaxError.
 */
export async function safeJson<T = any>(res: Response, fallback: T | null = null): Promise<T | null> {
  try {
    const contentType = res.headers.get('content-type') || '';
    // If clearly HTML or not JSON, avoid standard syntax error crash
    if (contentType.includes('text/html')) {
      console.warn(`[safeJson] Expected JSON but received HTML (status ${res.status}): ${res.url}`);
      return fallback;
    }
    const text = await res.text();
    if (!text || !text.trim()) {
      return fallback;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.startsWith('<!doctype') || trimmed.startsWith('<!DOCTYPE')) {
      console.warn(`[safeJson] Received HTML payload instead of JSON (status ${res.status})`);
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (err: any) {
    console.warn('[safeJson] JSON parse failed gracefully:', err?.message || err);
    return fallback;
  }
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
      return await safeJson<T>(res, (fallback ?? null) as T | null);
    }
    return fallback ?? null;
  } catch (err: any) {
    console.warn(`[Network] apiFetchJson error on ${url}:`, err?.message || err);
    return fallback ?? null;
  }
}

