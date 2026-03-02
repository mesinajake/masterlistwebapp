// ─── Master List Types ────────────────────────────────

export interface MasterListRow {
  id: string;
  rowIndex: number;
  data: Record<string, string | number | boolean | null>;
}

export interface MasterListResponse {
  data: MasterListRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  meta: {
    uploadId: string;
    uploadedAt: string;
    uploadedBy: string;
  };
}

export interface ColumnsResponse {
  columns: string[];
  uploadId: string;
}

/** DB row shape for master_list_rows */
export interface MasterListRowDB {
  id: string;
  upload_id: string;
  row_index: number;
  /** Can be array (new format) or object (legacy format) */
  data: unknown[] | Record<string, unknown>;
  search_vector?: string;
}
