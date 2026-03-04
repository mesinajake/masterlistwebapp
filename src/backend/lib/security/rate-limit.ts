import "server-only";

/**
 * Simple in-memory rate limiter.
 *
 * Uses a sliding window approach keyed by a string identifier (e.g., user ID).
 * NOT suitable for horizontally-scaled deployments — use Redis for that.
 *
 * For this internal tool with single-process deployment, in-memory is appropriate.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // epoch ms
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

/**
 * Create a rate limiter with a specific limit and window.
 * @param name - unique name for this limiter (e.g., "upload", "api")
 * @param maxRequests - max allowed requests in the window
 * @param windowMs - window duration in milliseconds
 */
export function createRateLimiter(
  name: string,
  maxRequests: number,
  windowMs: number
) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  // Periodic cleanup — remove expired entries every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    });
  }, 60_000);
  // Don't block process exit
  if (cleanupInterval.unref) cleanupInterval.unref();

  return {
    /**
     * Check if a request is allowed for the given key.
     * @returns { allowed: true } or { allowed: false, retryAfterMs }
     */
    check(key: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || entry.resetAt <= now) {
        // New window
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
      }

      if (entry.count < maxRequests) {
        entry.count++;
        return { allowed: true };
      }

      return {
        allowed: false,
        retryAfterMs: entry.resetAt - now,
      };
    },

    /** Reset the limiter for a specific key (e.g., after successful completion). */
    reset(key: string): void {
      store.delete(key);
    },
  };
}

// ─── Pre-configured rate limiters ─────────────────────────────────

/** Upload rate limiter: 3 uploads per 5 minutes per user */
export const uploadRateLimiter = createRateLimiter("upload", 3, 5 * 60 * 1000);

/** API read rate limiter: 120 requests per minute per user */
export const apiRateLimiter = createRateLimiter("api", 120, 60 * 1000);
