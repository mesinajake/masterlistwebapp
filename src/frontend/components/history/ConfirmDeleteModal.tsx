"use client";

import { Modal } from "@/frontend/components/ui/Modal";
import { Button } from "@/frontend/components/ui";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  fileName: string;
  rowCount: number;
}

/**
 * A styled confirmation modal for deleting uploads.
 * Replaces the browser's native confirm() dialog.
 */
export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  fileName,
  rowCount,
}: ConfirmDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Upload" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500 text-[22px] mt-0.5">
              warning
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                This action cannot be undone
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">
                This will permanently delete{" "}
                <span className="font-semibold">{fileName}</span> and all{" "}
                <span className="font-semibold">
                  {rowCount.toLocaleString()}
                </span>{" "}
                associated rows.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            isLoading={isDeleting}
            disabled={isDeleting}
          >
            <span className="material-symbols-outlined text-[16px]">
              delete
            </span>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
