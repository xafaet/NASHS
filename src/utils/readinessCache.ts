/**
 * Client-Side Database Readiness Cache
 * 
 * Prevents redundant, jarring full-screen database verification screens
 * across page navigation and intra-session page loads.
 * Provides resilient fallback and automatic expiration policies.
 */

export type AppReadinessState =
  | 'OPERATIONAL'
  | 'FRESH_INSTALLATION'
  | 'DATABASE_UNAVAILABLE'
  | 'SCHEMA_INCOMPLETE';

export interface CachedReadiness {
  state: AppReadinessState;
  isInstalled: boolean;
  timestamp: number;
  report?: any;
}

const STORAGE_KEY = 'nash_db_readiness_cache';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for verified operational state

// In-memory fallback if sessionStorage is blocked
let memoryCache: CachedReadiness | null = null;

export function getCachedReadiness(): CachedReadiness | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CachedReadiness = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp || 0);
        // Only return if still within TTL
        if (age < CACHE_TTL_MS) {
          return parsed;
        }
      }
    }
  } catch {
    // SessionStorage inaccessible, fallback to memory
  }

  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache;
  }

  return null;
}

export function setCachedReadiness(
  state: AppReadinessState,
  isInstalled: boolean,
  report?: any
): void {
  const item: CachedReadiness = {
    state,
    isInstalled,
    timestamp: Date.now(),
    report,
  };

  memoryCache = item;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(item));
    }
  } catch {
    // Ignore storage quota or disabled storage
  }
}

export function clearReadinessCache(): void {
  memoryCache = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}
