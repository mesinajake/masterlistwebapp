// ─── Upload Types ─────────────────────────────────────

export interface Upload {
  id: string;
  fileName: string;
  rowCount: number;
  isActive: boolean;
  columnHeaders: string[];
  uploadedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface UploadPreview {
  uploadId: string;
  fileName: string;
  rowCount: number;
  columns: string[];
  preview: Record<string, string | number | null>[];
  status: "pending_confirmation";
}

/** Progress event emitted during upload streaming */
export interface UploadProgress {
  stage: "parsing" | "inserting" | "preview" | "vectors" | "indexing" | "complete" | "error";
  /** Note: "vectors" and "indexing" stages are no longer emitted during upload.
   *  Vectorization happens in background after upload completes.
   *  "preview" is emitted after the first batch COPY completes — frontend
   *  can show a preview table while remaining batches continue inserting. */

  progress: number; // 0–100
  detail?: string;
  data?: UploadPreview;
}

/** DB row shape for master_list_uploads */
export interface UploadRow {
  id: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  is_active: boolean;
  row_count: number;
  column_headers: string[] | null;
  created_at: string;
}
