"use client";

import { Button } from "@/frontend/components/ui";

interface UploadConfirmProps {
  fileName: string;
  rowCount: number;
  columnCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isActivating: boolean;
}

export function UploadConfirm({
  fileName,
  rowCount,
  columnCount,
  onConfirm,
  onCancel,
  isActivating,
}: UploadConfirmProps) {
  return (
    <div className="rounded-lg border border-border-light bg-white p-6 shadow-sm dark:border-border-dark dark:bg-bg-dark">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <span className="material-symbols-outlined text-primary">
            check_circle
          </span>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Ready to activate
          </h4>
          <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <strong>{fileName}</strong> — {rowCount.toLocaleString()} rows across{" "}
            {columnCount} columns parsed successfully.
          </p>
          <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Activating this upload will replace the current Master List for all users.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={isActivating}>
          Cancel
        </Button>
        <Button onClick={onConfirm} isLoading={isActivating}>
          <span className="material-symbols-outlined text-[16px]">
            published_with_changes
          </span>
          Activate as Master List
        </Button>
      </div>
    </div>
  );
}
