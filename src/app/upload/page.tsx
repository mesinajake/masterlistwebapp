"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/frontend/components/auth/AuthGuard";
import { RoleGuard } from "@/frontend/components/auth/RoleGuard";
import { Header } from "@/frontend/components/layout/Header";
import { UploadForm } from "@/frontend/components/upload/UploadForm";
import { PreviewTable } from "@/frontend/components/upload/PreviewTable";
import { UploadConfirm } from "@/frontend/components/upload/UploadConfirm";
import { useUpload } from "@/frontend/hooks/useUpload";
import { toast } from "sonner";

export default function UploadPage() {
  return (
    <AuthGuard>
      <RoleGuard requiredRole="da">
        <UploadContent />
      </RoleGuard>
    </AuthGuard>
  );
}

function UploadContent() {
  const {
    preview,
    upload,
    isUploading,
    uploadProgress,
    cancelUpload,
    activate,
    isActivating,
    reset,
  } = useUpload();

  // Derive initial step from persisted store state so returning
  // to this page after navigation restores the correct view.
  const [step, setStep] = useState<"upload" | "preview" | "done">(() =>
    preview ? "preview" : "upload"
  );

  // If preview becomes available while the user is on the page
  // (e.g. upload completes in background), auto-advance to preview.
  useEffect(() => {
    if (preview && step === "upload" && !isUploading) {
      setStep("preview");
      toast.success("File parsed successfully!");
    }
  }, [preview, step, isUploading]);

  const handleFileSelect = (file: File, password?: string) => {
    upload({ file, password }, {
      onSuccess: () => {
        setStep("preview");
        toast.success("File parsed successfully!");
      },
      onError: (err) => {
        toast.error(err.message || "Upload failed");
      },
    });
  };

  const handleActivate = () => {
    if (!preview?.uploadId) return;
    activate(preview.uploadId, {
      onSuccess: () => {
        setStep("done");
        toast.success("Master List activated!");
      },
      onError: (err) => {
        toast.error(err.message || "Activation failed");
      },
    });
  };

  const handleReset = () => {
    reset();
    setStep("upload");
  };

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <Header />

      <main className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark">
            Upload Master List
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Upload a file (.xlsx, .xls, .csv) to replace the current Master
            List data
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-4 mb-8">
          {["Upload File", "Preview Data", "Confirm"].map((label, i) => {
            const stepIndex =
              step === "upload" ? 0 : step === "preview" ? 1 : 2;
            const isActive = i === stepIndex;
            const isComplete = i < stepIndex;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isActive
                      ? "bg-primary text-white"
                      : isComplete
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                  }`}
                >
                  {isComplete ? "✓" : i + 1}
                </div>
                <span
                  className={`text-sm ${
                    isActive
                      ? "text-text-primary-light dark:text-text-primary-dark font-medium"
                      : "text-text-secondary-light dark:text-text-secondary-dark"
                  }`}
                >
                  {label}
                </span>
                {i < 2 && (
                  <div className="w-12 h-px bg-border-light dark:bg-border-dark" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {step === "upload" && (
          <UploadForm
            onUpload={handleFileSelect}
            onCancel={cancelUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
          />
        )}

        {step === "preview" && preview && (
          <div className="space-y-6">
            <PreviewTable
              columns={preview.columns}
              rows={preview.preview}
              totalRows={preview.rowCount}
            />
            <UploadConfirm
              fileName={preview.fileName}
              rowCount={preview.rowCount}
              columnCount={preview.columns.length}
              onConfirm={handleActivate}
              onCancel={handleReset}
              isActivating={isActivating}
            />
          </div>
        )}

        {step === "done" && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 mb-4">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-green-800 dark:text-green-200">
              Upload Complete
            </h2>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              The Master List has been updated and is now active.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a
                href="/"
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                View Dashboard
              </a>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
