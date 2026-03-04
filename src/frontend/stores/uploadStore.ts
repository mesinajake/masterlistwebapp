import { create } from "zustand";
import type { UploadPreview, UploadProgress } from "@/shared/types/upload";

/**
 * Global upload state store.
 *
 * Upload progress persists across SPA page navigations because the store
 * lives outside the React component tree. The NDJSON stream reader runs
 * in the module scope via `startStreamReader()`, so navigating away from
 * `/upload` does NOT interrupt the upload — the user can come back and
 * see current progress.
 */

interface UploadStoreState {
  /** Current upload progress (null = no upload in progress) */
  progress: UploadProgress | null;
  /** Preview data when upload completes */
  preview: UploadPreview | null;
  /** Whether an upload is currently in progress */
  isUploading: boolean;
  /** Upload error message */
  error: string | null;
  /** AbortController for cancelling the upload */
  abortController: AbortController | null;

  // ── Actions ─────────────────────────────
  setProgress: (p: UploadProgress | null) => void;
  setPreview: (p: UploadPreview | null) => void;
  setIsUploading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setAbortController: (c: AbortController | null) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadStoreState>((set) => ({
  progress: null,
  preview: null,
  isUploading: false,
  error: null,
  abortController: null,

  setProgress: (progress) => set({ progress }),
  setPreview: (preview) => set({ preview }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setError: (error) => set({ error }),
  setAbortController: (abortController) => set({ abortController }),
  reset: () =>
    set({
      progress: null,
      preview: null,
      isUploading: false,
      error: null,
      abortController: null,
    }),
}));
