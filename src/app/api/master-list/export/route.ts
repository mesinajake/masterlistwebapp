import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne, query, rpc } from "@/backend/lib/db";
import { rowsToCSV } from "@/backend/lib/csv/exporter";
import { MAX_EXPORT_ROWS } from "@/shared/utils/constants";

/**
 * GET /api/master-list/export
 * Export filtered/searched results as a CSV download.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!isPayload(authResult)) return authResult;

  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("search") || searchParams.get("q") || "";

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
          // ignore
        }
      }
    }

    // Get active upload
    const { data: activeUpload } = await queryOne<{
      id: string;
      column_headers: string[];
    }>(
      "SELECT id, column_headers FROM master_list_uploads WHERE is_active = true",
      []
    );

    if (!activeUpload) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "No active Master List" },
        { status: 404 }
      );
    }

    const colHeaders = activeUpload.column_headers ?? [];
    const hasFilters = Object.keys(filters).length > 0;
    const hasSearch = q.trim().length > 0;

    let exportRows: { data: unknown }[];

    if (hasFilters || hasSearch) {
      // Use RPC for filtered/searched queries (60 s timeout)
      const { data: rpcResult, error: rpcError } = await rpc<{
        total: number;
        rows: { id: string; row_index: number; data: unknown }[];
      }>(
        "filter_master_list",
        {
          p_upload_id: activeUpload.id,
          p_filters: JSON.stringify(filters),
          p_column_headers: colHeaders,
          p_search: q.trim(),
          p_page_size: MAX_EXPORT_ROWS,
          p_offset: 0,
        }
      );

      if (rpcError) {
        console.error("filter_master_list RPC error (export):", rpcError);
        return NextResponse.json(
          { error: "QUERY_ERROR", message: rpcError.message },
          { status: 500 }
        );
      }

      const result = rpcResult as { total: number; rows: { id: string; row_index: number; data: unknown }[] };
      exportRows = (result?.rows ?? []).map((r) => ({ data: r.data }));
    } else {
      // Simple export — no filter/search
      const { data: rows, error } = await query<{ data: unknown }>(
        `SELECT data FROM master_list_rows
         WHERE upload_id = $1
         ORDER BY row_index ASC
         LIMIT $2`,
        [activeUpload.id, MAX_EXPORT_ROWS]
      );

      if (error) {
        console.error("Export query error:", error);
        return NextResponse.json(
          { error: "QUERY_ERROR", message: "Failed to export data" },
          { status: 500 }
        );
      }

      exportRows = (rows ?? []) as { data: unknown }[];
    }

    const headers = colHeaders;

    // Reconstruct named objects from array-format data for CSV export
    const namedRows = exportRows.map((r) => {
      const rawData = r.data;
      if (Array.isArray(rawData)) {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = (rawData as unknown[])[i] ?? null;
        });
        return obj;
      }
      return rawData as Record<string, unknown>;
    });

    const csvData = rowsToCSV(headers, namedRows);

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="masterlist_export_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error("GET /api/master-list/export error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
