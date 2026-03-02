import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne, query, rpc } from "@/backend/lib/db";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/utils/constants";

/**
 * GET /api/master-list
 * Fetch paginated master list rows with full-text search and column filtering.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!isPayload(authResult)) return authResult;

  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("search") || searchParams.get("q") || "";
    const rawPage = Number(searchParams.get("page")) || 1;
    const rawPageSize = Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
    const page = Math.max(1, rawPage);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
    const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    // Parse column filters — supports both:
    //   ?filter=column:value&filter=column2:value2    (from frontend)
    //   ?filters={"column":"value"}                   (legacy JSON)
    const filters: Record<string, string> = {};

    // Parse modern format: ?filter=col:val
    const filterParams = searchParams.getAll("filter");
    for (const fp of filterParams) {
      const colonIdx = fp.indexOf(":");
      if (colonIdx > 0) {
        const col = fp.substring(0, colonIdx);
        const val = fp.substring(colonIdx + 1);
        if (col && val) filters[col] = val;
      }
    }

    // Fallback: legacy JSON format ?filters={"col":"val"}
    if (Object.keys(filters).length === 0) {
      const filtersRaw = searchParams.get("filters") || "";
      if (filtersRaw) {
        try {
          const parsed = JSON.parse(filtersRaw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            for (const [key, value] of Object.entries(parsed)) {
              if (typeof value === "string" && value) {
                filters[key] = value;
              }
            }
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }

    // Get the active upload (include column_headers for array→object reconstruction)
    const { data: activeUpload } = await queryOne<{
      id: string;
      created_at: string;
      uploaded_by: string;
      column_headers: string[];
      row_count: number;
    }>(
      "SELECT id, created_at, uploaded_by, column_headers, row_count FROM master_list_uploads WHERE is_active = true",
      []
    );

    if (!activeUpload) {
      return NextResponse.json({
        data: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        meta: { uploadId: null, uploadedAt: null, uploadedBy: null },
      });
    }

    // Get uploader name
    const { data: uploader } = await queryOne<{ name: string }>(
      "SELECT name FROM users WHERE id = $1",
      [activeUpload.uploaded_by]
    );

    const offset = (page - 1) * pageSize;
    const columnHeaders = activeUpload.column_headers ?? [];
    const hasFilters = Object.keys(filters).length > 0;
    const hasSearch = q.trim().length > 0;

    // ── Helper: reconstruct named objects from array data ──────
    const reconstructRow = (r: { id: string; row_index: number; data: unknown }) => {
      const rawData = r.data;
      let namedData: Record<string, unknown>;

      if (Array.isArray(rawData)) {
        namedData = {};
        columnHeaders.forEach((h, i) => {
          namedData[h] = (rawData as unknown[])[i] ?? null;
        });
      } else {
        namedData = rawData as Record<string, unknown>;
      }

      return { id: r.id, rowIndex: r.row_index, data: namedData };
    };

    let total: number;
    let rows: { id: string; row_index: number; data: unknown }[];

    // ────────────────────────────────────────────────────────────
    // Use RPC for filtered/searched queries (60 s timeout, GIN pre-filter).
    // Fall back to direct SQL for simple pagination (fast, no timeout risk).
    // ────────────────────────────────────────────────────────────
    if (hasFilters || hasSearch) {
      const { data: rpcResult, error: rpcError } = await rpc<{
        total: number;
        rows: { id: string; row_index: number; data: unknown }[];
      }>(
        "filter_master_list",
        {
          p_upload_id: activeUpload.id,
          p_filters: JSON.stringify(filters),
          p_column_headers: columnHeaders,
          p_search: q.trim(),
          p_page_size: pageSize,
          p_offset: offset,
        }
      );

      if (rpcError) {
        console.error("filter_master_list RPC error:", rpcError);
        return NextResponse.json(
          { error: "QUERY_ERROR", message: rpcError.message },
          { status: 500 }
        );
      }

      // RPC returns { total, rows }
      const result = rpcResult as { total: number; rows: { id: string; row_index: number; data: unknown }[] };
      total = result?.total ?? 0;
      rows = result?.rows ?? [];
    } else {
      // Simple paginated query — no filter/search.
      const orderDir = sortOrder === "asc" ? "ASC" : "DESC";
      const { data: qRows, error } = await query<{
        id: string;
        row_index: number;
        data: unknown;
      }>(
        `SELECT id, row_index, data FROM master_list_rows
         WHERE upload_id = $1
         ORDER BY row_index ${orderDir}
         LIMIT $2 OFFSET $3`,
        [activeUpload.id, pageSize, offset]
      );

      if (error) {
        console.error("Master list query error:", error);
        return NextResponse.json(
          { error: "QUERY_ERROR", message: error.message },
          { status: 500 }
        );
      }

      total = activeUpload.row_count ?? 0;
      rows = (qRows ?? []) as { id: string; row_index: number; data: unknown }[];
    }

    return NextResponse.json({
      data: rows.map(reconstructRow),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      meta: {
        uploadId: activeUpload.id,
        uploadedAt: activeUpload.created_at,
        uploadedBy: uploader?.name ?? "Unknown",
      },
    });
  } catch (error) {
    console.error("GET /api/master-list error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
