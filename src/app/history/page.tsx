"use client";

import { useState } from "react";
import { AuthGuard } from "@/frontend/components/auth/AuthGuard";
import { Header } from "@/frontend/components/layout/Header";
import { HistoryTable } from "@/frontend/components/history/HistoryTable";
import { ConfirmDeleteModal } from "@/frontend/components/history/ConfirmDeleteModal";
import { useUploadHistory } from "@/frontend/hooks/useUploadHistory";
import { useUpload } from "@/frontend/hooks/useUpload";
import { useAuthStore } from "@/frontend/stores/authStore";
import { TableSkeleton } from "@/frontend/components/ui/Skeleton";
import { toast } from "sonner";
import type { Upload } from "@/shared/types/upload";

export default function HistoryPage() {
  return (
    <AuthGuard>
      <HistoryContent />
    </AuthGuard>
  );
}

function HistoryContent() {
  const { data: uploads, isLoading, error } = useUploadHistory();
  const { activate, deleteUpload, isDeleting } = useUpload();
  const { user } = useAuthStore();
  const isDA = user?.role === "da" || user?.role === "super_admin";
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Upload | null>(null);

  const handleActivate = (uploadId: string) => {
    setActivatingId(uploadId);
    activate(uploadId, {
      onSuccess: () => {
        toast("Activated Successfully", {
          style: {
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E40AF",
          },
        });
        setActivatingId(null);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to activate upload");
        setActivatingId(null);
      },
    });
  };

  const handleDeleteRequest = (upload: Upload) => {
    setDeleteTarget(upload);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteUpload(deleteTarget.id, {
      onSuccess: () => {
        toast("Deleted Successfully", {
          style: {
            background: "#FEF2F2",
            border: "1px solid #FEE2E2",
            color: "#991B1B",
          },
        });
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete upload");
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark">
            Upload History
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            View and manage previous Master List uploads
          </p>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">
              Failed to load upload history
            </p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">
              {error.message}
            </p>
          </div>
        ) : (
          <HistoryTable
            uploads={uploads ?? []}
            onActivate={handleActivate}
            onDelete={handleDeleteRequest}
            isActivating={activatingId}
            isDeletingId={isDeleting ? deleteTarget?.id ?? null : null}
            canDelete={isDA}
          />
        )}
      </main>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        fileName={deleteTarget?.fileName ?? ""}
        rowCount={deleteTarget?.rowCount ?? 0}
      />
    </div>
  );
}
