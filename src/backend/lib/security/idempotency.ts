import "server-only";

/**
 * In-memory idempotency token store.
 * Prevents duplicate upload submissions within a time window.
 * Tokens auto-expire after TTL to prevent memory leaks.
 */

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 min

const tokens = new Map<string, number>(); // token → expiry timestamp

// Periodic cleanup of expired tokens
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    tokens.forEach((expiry, key) => {
      if (expiry < now) tokens.delete(key);
    });
    // Stop timer if no tokens remain
    if (tokens.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Check and consume an idempotency token.
 * Returns true if the token is new (first use), false if duplicate.
 */
export function consumeIdempotencyToken(token: string): boolean {
  // Clean expired tokens on access
  const now = Date.now();
  const existing = tokens.get(token);
  if (existing !== undefined) {
    // Token exists and not expired → duplicate
    if (existing > now) return false;
    // Token expired — treat as new
  }

  tokens.set(token, now + TOKEN_TTL_MS);
  ensureCleanup();
  return true;
}
