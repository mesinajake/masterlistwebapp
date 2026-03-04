"use client";

import { useCallback, useState, useRef, type DragEvent } from "react";
import { cn } from "@/shared/utils/cn";
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_SIZE } from "@/shared/utils/constants";

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

export function DropZone({ onFileSelect, disabled, className }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      const ext = file.name
        .substring(file.name.lastIndexOf("."))
        .toLowerCase();

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setError(`Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
        return;
      }

      if (file.size > MAX_UPLOAD_SIZE) {
        setError(
          `File too large. Maximum: ${MAX_UPLOAD_SIZE / (1024 * 1024)} MB`
        );
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [disabled, validateAndSelect]
  );

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-border-light hover:border-primary/50 dark:border-border-dark",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Drop file here or click to browse"
    >
      <span className="material-symbols-outlined text-[48px] text-text-secondary-light dark:text-text-secondary-dark mb-3">
        upload_file
      </span>
      <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        Drag & drop your file here
      </p>
      <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
        or click to browse — .xlsx, .xls, .csv up to {MAX_UPLOAD_SIZE / (1024 * 1024)} MB
      </p>

      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) validateAndSelect(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
