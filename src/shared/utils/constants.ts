// ─── App Constants ────────────────────────────────────

/** Maximum file size for uploads (300 MB) */
export const MAX_UPLOAD_SIZE = 300 * 1024 * 1024;

/** Accepted MIME types */
export const ACCEPTED_FILE_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
];

/** Accepted file extensions */
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

/** Default page size for table pagination */
export const DEFAULT_PAGE_SIZE = 25;

/** Maximum page size allowed */
export const MAX_PAGE_SIZE = 100;

/** Search debounce delay (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Number of rows to preview after parsing */
export const PREVIEW_ROW_COUNT = 10;

/** Batch size for inserting rows into DB (keep small for large JSONB payloads) */
export const INSERT_BATCH_SIZE = 200;

/** Maximum number of rows allowed in a single Excel upload */
export const MAX_UPLOAD_ROWS = 500_000;

/** Maximum number of columns allowed in an Excel upload */
export const MAX_UPLOAD_COLUMNS = 100;

/** Maximum rows for CSV export (to prevent memory exhaustion) */
export const MAX_EXPORT_ROWS = 100_000;

/** Cookie name for auth session */
export const SESSION_COOKIE_NAME = "ml_session";

/** JWT expiry (24 hours in seconds) */
export const JWT_EXPIRY_SECONDS = 24 * 60 * 60;

/** App name */
export const APP_NAME = "MasterList";
