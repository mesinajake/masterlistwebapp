"use client";

import { useState } from "react";
import { DropZone, Button, Input } from "@/frontend/components/ui";
import type { UploadProgress } from "@/shared/types/upload";

interface UploadFormProps {
  onUpload: (file: File, password?: string) => void;
  onCancel?: () => void;
  isUploading: boolean;
  uploadProgress?: UploadProgress | null;
}

const STAGE_LABELS: Record<string, string> = {
  parsing: "Parsing File",
  inserting: "Inserting Rows",
  preview: "Inserting Rows",
  complete: "Complete",
  error: "Error",
};

const STAGE_ICONS: Record<string, string> = {
  parsing: "description",
  inserting: "database",
  preview: "database",
  complete: "check_circle",
  error: "error",
};

/** Compute an overall progress (0–100) that never resets between stages */
function computeOverallProgress(up: UploadProgress): number {
  // Weights: parsing 0–15%, inserting 15–100%
  // (vectorization now happens in background — admin doesn't wait)
  const stageP = Math.max(0, Math.min(100, up.progress));
  switch (up.stage) {
    case "parsing":
      return Math.round((stageP / 100) * 15);
    case "inserting":
    case "preview":
      return Math.round(15 + (stageP / 100) * 85);
    case "complete":
      return 100;
    case "error":
      return 0;
    default:
      return 0;
  }
}

export function UploadForm({ onUpload, onCancel, isUploading, uploadProgress }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, password || undefined);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone + file info — hidden once upload starts */}
      {!isUploading && (
        <>
          <DropZone
            onFileSelect={handleFileSelect}
            disabled={isUploading}
          />

          {selectedFile && (
            <div className="rounded-lg border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-primary">
                    description
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      {selectedFile.size >= 1024 * 1024
                        ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(selectedFile.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setPassword("");
                      setShowPassword(false);
                    }}
                    disabled={isUploading}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {/* Password section */}
              <div className="mt-4 border-t border-border-light pt-4 dark:border-border-dark">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "expand_less" : "expand_more"}
                  </span>
                  <span className="material-symbols-outlined text-[18px]">
                    lock
                  </span>
                  File is password-protected?
                </button>
                {showPassword && (
                  <div className="mt-3 max-w-sm">
                    <Input
                      type="password"
                      placeholder="Enter file password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isUploading}
                    />
                    <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      Leave blank if the file is not encrypted
                    </p>
                  </div>
                )}
              </div>

              {/* Upload button */}
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleUpload}
                  isLoading={isUploading}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    cloud_upload
                  </span>
                  Upload & Parse
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Progress bar */}
      {isUploading && uploadProgress && (() => {
        const overall = computeOverallProgress(uploadProgress);
        return (
          <div className="rounded-lg border border-border-light bg-surface-light p-5 dark:border-border-dark dark:bg-surface-dark">
            {/* Current stage header */}
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`material-symbols-outlined text-[22px] ${
                  uploadProgress.stage === "error"
                    ? "text-red-500"
                    : uploadProgress.stage === "complete"
                      ? "text-green-500"
                      : "text-primary animate-pulse"
                }`}
              >
                {STAGE_ICONS[uploadProgress.stage] ?? "hourglass_empty"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  {STAGE_LABELS[uploadProgress.stage] ?? uploadProgress.stage}
                </p>
                {uploadProgress.detail && (
                  <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
                    {uploadProgress.detail}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-primary tabular-nums">
                {overall}%
              </span>
            </div>

            {/* Overall progress bar (never resets) */}
            <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  uploadProgress.stage === "error"
                    ? "bg-red-500"
                    : "bg-primary"
                }`}
                style={{ width: `${overall}%` }}
              />
            </div>

            {/* Cancel button below progress bar */}
            {onCancel && uploadProgress.stage !== "complete" && (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
