"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UploadPreview, UploadProgress } from "@/shared/types/upload";

interface UploadParams {
  file: File;
  password?: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );

  const resetProgress = useCallback(() => setUploadProgress(null), []);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, password }: UploadParams) => {
      // Reset progress at the start
      setUploadProgress({ stage: "parsing", progress: 0, detail: "Uploading file..." });

      const formData = new FormData();
      formData.append("file", file);
      if (password) {
        formData.append("password", password);
      }

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

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

            setUploadProgress({
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
      setPreview(data);
      queryClient.invalidateQueries({ queryKey: ["master-list"] });
      queryClient.invalidateQueries({ queryKey: ["columns"] });
      queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
    onError: () => {
      setUploadProgress(null);
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
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    activate: activateMutation.mutate,
    isActivating: activateMutation.isPending,
    activateError: activateMutation.error,
    deleteUpload: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
    reset: () => {
      setPreview(null);
      resetProgress();
      uploadMutation.reset();
    },
  };
}
