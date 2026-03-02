"use client";

import { Badge, Button } from "@/frontend/components/ui";
import type { Upload } from "@/shared/types/upload";

interface HistoryTableProps {
  uploads: Upload[];
  onActivate: (id: string) => void;
  onDelete: (upload: Upload) => void;
  isActivating: string | null;
  isDeletingId: string | null;
  canDelete?: boolean;
}

export function HistoryTable({
  uploads,
  onActivate,
  onDelete,
  isActivating,
  isDeletingId,
  canDelete = false,
}: HistoryTableProps) {
  if (uploads.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-text-secondary-light/50">
            history
          </span>
          <p className="mt-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            No uploads yet
          </p>
          <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Upload your first Master List to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-bg-dark overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-surface-dark/50">
            <tr>
              <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
                File Name
              </th>
              <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
                Rows
              </th>
              <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
                Uploaded By
              </th>
              <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
                Date
              </th>
              <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
                Status
              </th>
              <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {uploads.map((upload) => (
              <tr
                key={upload.id}
                className="hover:bg-blue-50/50 dark:hover:bg-primary/5 transition-colors"
              >
                <td className="px-6 py-4 font-medium text-text-primary-light dark:text-text-primary-dark">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-text-secondary-light">
                      description
                    </span>
                    {upload.fileName}
                  </div>
                </td>
                <td className="px-6 py-4 text-text-secondary-light dark:text-text-secondary-dark">
                  {upload.rowCount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-text-secondary-light dark:text-text-secondary-dark">
                  {upload.uploadedBy.name}
                </td>
                <td className="px-6 py-4 text-text-secondary-light dark:text-text-secondary-dark">
                  {new Date(upload.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-6 py-4">
                  {upload.isActive ? (
                    <Badge variant="green">Active</Badge>
                  ) : (
                    <Badge variant="gray">Inactive</Badge>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!upload.isActive && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onActivate(upload.id)}
                          isLoading={isActivating === upload.id}
                          disabled={isActivating !== null || isDeletingId !== null}
                        >
                          Activate
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(upload)}
                            isLoading={isDeletingId === upload.id}
                            disabled={isActivating !== null || isDeletingId !== null}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
