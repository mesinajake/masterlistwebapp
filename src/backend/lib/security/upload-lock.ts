import "server-only";

/**
 * In-memory upload mutex to prevent concurrent uploads from
 * corrupting shared database state (GIN index, search trigger).
 *
 * Only one upload can be actively processing at a time.
 * Additional uploads are rejected with a clear error message.
 *
 * Why not advisory locks? The upload route uses a streaming
 * response pattern (fire-and-forget async IIFE) that makes
 * transaction-scoped advisory locks impractical.
 */

let activeUpload: {
  uploadId: string | null;
  userId: string;
  startedAt: number;
  fileName: string;
} | null = null;

/** Maximum time an upload can hold the lock (10 minutes).
 *  After this, the lock is considered stale and can be stolen. */
const MAX_LOCK_DURATION_MS = 10 * 60 * 1000;

/**
 * Attempt to acquire the upload lock.
 * @returns true if acquired, false if another upload is in progress.
 */
export function acquireUploadLock(
  userId: string,
  fileName: string
): { acquired: true } | { acquired: false; message: string } {
  const now = Date.now();

  // Check for stale lock
  if (activeUpload && now - activeUpload.startedAt > MAX_LOCK_DURATION_MS) {
    console.warn(
      `[upload-lock] Releasing stale lock from user ${activeUpload.userId} ` +
      `(held for ${Math.round((now - activeUpload.startedAt) / 1000)}s)`
    );
    activeUpload = null;
  }

  if (activeUpload) {
    return {
      acquired: false,
      message:
        `Another upload is already in progress. ` +
        `Please wait for it to complete before uploading again.`,
    };
  }

  activeUpload = { uploadId: null, userId, startedAt: now, fileName };
  return { acquired: true };
}

/**
 * Update the lock with the actual upload ID once the record is created.
 */
export function setUploadLockId(uploadId: string): void {
  if (activeUpload) {
    activeUpload.uploadId = uploadId;
  }
}

/**
 * Release the upload lock.
 * Only the holder (by userId) or a forced release can clear it.
 */
export function releaseUploadLock(userId?: string): void {
  if (!activeUpload) return;

  if (!userId || activeUpload.userId === userId) {
    activeUpload = null;
  }
}

/**
 * Check if a specific user currently holds the upload lock.
 */
export function isUploadLocked(): boolean {
  if (!activeUpload) return false;

  // Check for stale
  if (Date.now() - activeUpload.startedAt > MAX_LOCK_DURATION_MS) {
    activeUpload = null;
    return false;
  }

  return true;
}

/**
 * Get current lock status (for debugging/admin endpoints).
 */
export function getUploadLockStatus(): {
  locked: boolean;
  userId?: string;
  fileName?: string;
  elapsedSeconds?: number;
} {
  if (!activeUpload || Date.now() - activeUpload.startedAt > MAX_LOCK_DURATION_MS) {
    return { locked: false };
  }

  return {
    locked: true,
    userId: activeUpload.userId,
    fileName: activeUpload.fileName,
    elapsedSeconds: Math.round((Date.now() - activeUpload.startedAt) / 1000),
  };
}
