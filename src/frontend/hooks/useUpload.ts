"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUploadStore } from "@/frontend/stores/uploadStore";
import type { UploadPreview, UploadProgress } from "@/shared/types/upload";
import {
  shouldParseClientSide,
  parseExcelClientSide,
} from "@/frontend/lib/client-excel-parser";

interface UploadParams {
  file: File;
  password?: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  const store = useUploadStore();
  const {
    progress: uploadProgress,
    preview,
    isUploading: storeIsUploading,
    setProgress,
    setPreview,
    setIsUploading,
    setError,
    setAbortController,
    reset: resetStore,
  } = store;

  const cancelUpload = useCallback(() => {
    const ctrl = useUploadStore.getState().abortController;
    if (ctrl) {
      ctrl.abort();
    }
    resetStore();
  }, [resetStore]);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, password }: UploadParams) => {
      // Create a new AbortController for this upload
      const controller = new AbortController();
      setAbortController(controller);
      setIsUploading(true);
      setError(null);

      // Reset progress at the start
      setProgress({ stage: "parsing", progress: 0, detail: "Preparing file..." });

      // ── Client-side Excel parsing ──────────────────────
      // For Excel files: parse in browser → convert to CSV → upload CSV
      // This moves ~60-75s of server-side parsing to the client.
      let uploadFile: File | Blob = file;
      let uploadFileName = file.name;

      if (shouldParseClientSide(file.name)) {
        try {
          setProgress({
            stage: "parsing",
            progress: 5,
            detail: "Parsing Excel file in browser...",
          });

          const parseResult = await parseExcelClientSide(
            file,
            password,
            (message) => {
              setProgress({
                stage: "parsing",
                progress: 10,
                detail: message,
              });
            },
            controller.signal
          );

          // Use the CSV output instead of the original Excel file
          uploadFile = parseResult.csvBlob;
          uploadFileName = parseResult.csvFileName;
          // Don't send password — the CSV is already decrypted
          password = undefined;

          console.log(
            `[useUpload] Client-side parse complete: ${parseResult.rowCount} rows, ` +
            `sheet: "${parseResult.sheetName}", CSV size: ${(parseResult.csvBlob.size / 1024 / 1024).toFixed(1)} MB`
          );

          setProgress({
            stage: "parsing",
            progress: 15,
            detail: `Parsed ${parseResult.rowCount.toLocaleString()} rows. Uploading CSV...`,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") throw err;
          // Fall back to server-side parsing if client-side fails
          console.warn("[useUpload] Client-side parse failed, falling back to server:", err);
          setProgress({
            stage: "parsing",
            progress: 5,
            detail: "Uploading file for server-side parsing...",
          });
        }
      }

      const formData = new FormData();
      // Append the file (CSV or original Excel) with the appropriate name
      formData.append("file", uploadFile, uploadFileName);
      if (password) {
        formData.append("password", password);
      }

      // Generate idempotency token to prevent duplicate submissions
      const idempotencyToken = crypto.randomUUID();
      formData.append("idempotencyToken", idempotencyToken);

      // Retry with exponential backoff on network errors only
      const MAX_RETRIES = 3;
      let lastError: Error | null = null;
      let res: Response | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (controller.signal.aborted) {
          throw new DOMException("Upload cancelled", "AbortError");
        }

        try {
          // Re-create FormData for retries (streams can't be re-read)
          const retryFormData = new FormData();
          retryFormData.append("file", file);
          if (password) retryFormData.append("password", password);
          retryFormData.append("idempotencyToken", idempotencyToken);

          res = await fetch("/api/uploads", {
            method: "POST",
            body: retryFormData,
            signal: controller.signal,
          });
          lastError = null;
          break; // Success — got a response (even if HTTP error)
        } catch (err) {
          // Don't retry user cancellation
          if (err instanceof DOMException && err.name === "AbortError") {
            throw err;
          }
          // Network error — retry with backoff
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // 1s, 2s, 4s
            setProgress({
              stage: "parsing",
              progress: 0,
              detail: `Network error. Retrying in ${delay / 1000}s... (attempt ${attempt + 2}/${MAX_RETRIES + 1})`,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (lastError || !res) {
        throw lastError || new Error("Upload failed after retries");
      }

      if (!res.ok) {
        // Non-streaming error (e.g. 400 validation)
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }

      // Read the NDJSON stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let result: UploadPreview | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as UploadProgress & { data?: unknown };

            if (event.stage === "error") {
              throw new Error(event.detail || "Upload processing failed");
            }

            if (event.stage === "complete" && event.data) {
              result = event.data as UploadPreview;
            }

            setProgress({
              stage: event.stage,
              progress: event.progress,
              detail: event.detail,
            });
          } catch (e) {
            // Only swallow JSON parse errors — rethrow everything else
            if (e instanceof SyntaxError) {
              console.warn("[useUpload] Failed to parse progress event:", line);
            } else {
              throw e;
            }
          }
        }
      }

      if (!result) {
        throw new Error("Upload completed without result data");
      }

      return result;
    },
    onSuccess: (data) => {
      setAbortController(null);
      setIsUploading(false);
      setPreview(data);
      queryClient.invalidateQueries({ queryKey: ["master-list"] });
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
    onError: (error) => {
      setAbortController(null);
      setIsUploading(false);
      // Don't show error state for user-initiated cancellations
      if (error instanceof DOMException && error.name === "AbortError") {
        setProgress(null);
        return;
      }
      setError(error instanceof Error ? error.message : String(error));
      setProgress(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      const res = await fetch(`/api/uploads/${uploadId}/activate`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to activate upload");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-list"] });
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      const res = await fetch(`/api/uploads/${uploadId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete upload");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  return {
    preview,
    setPreview,
    uploadProgress,
    upload: uploadMutation.mutate,
    isUploading: storeIsUploading || uploadMutation.isPending,
    uploadError: uploadMutation.error,
    cancelUpload,
    activate: activateMutation.mutate,
    isActivating: activateMutation.isPending,
    activateError: activateMutation.error,
    deleteUpload: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
    reset: () => {
      cancelUpload();
      resetStore();
      uploadMutation.reset();
    },
  };
}
