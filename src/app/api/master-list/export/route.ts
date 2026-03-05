import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne, rpc, getClient } from "@/backend/lib/db";
import { csvHeaderLine, rowToCSVLine } from "@/backend/lib/csv/exporter";
import { MAX_EXPORT_ROWS } from "@/shared/utils/constants";
import { apiRateLimiter } from "@/backend/lib/security/rate-limit";
import type { PoolClient } from "pg";
import Cursor from "pg-cursor";

/**
 * GET /api/master-list/export
 * Export filtered/searched results as a streaming CSV download.
 * Uses a database cursor to avoid loading all rows into memory.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!isPayload(authResult)) return authResult;

  // Rate limit: 120 requests per minute per user
  const rateCheck = apiRateLimiter.check(authResult.sub);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("search") || searchParams.get("q") || "";

    // Parse column filters
    const filters: Record<string, string> = {};
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

    // ── Filtered/searched export: use RPC (bounded by MAX_EXPORT_ROWS) ──
    if (hasFilters || hasSearch) {
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
      const exportRows = result?.rows ?? [];

      // For filtered results (typically smaller), build CSV in memory
      const lines: string[] = [csvHeaderLine(colHeaders)];
      for (const row of exportRows) {
        lines.push(rowToCSVLine(colHeaders, row.data));
      }

      return new NextResponse(lines.join("\r\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="masterlist_export_${Date.now()}.csv"`,
        },
      });
    }

    // ── Unfiltered export: stream via cursor to avoid OOM ──
    const client: PoolClient = await getClient();
    const CURSOR_BATCH = 5_000;
    let released = false;

    const stream = new ReadableStream({
      async start(controller) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cursor: any = null;
        try {
          // Send CSV header with BOM
          controller.enqueue(new TextEncoder().encode(csvHeaderLine(colHeaders) + "\r\n"));

          cursor = client.query(
            new Cursor(
              `SELECT data FROM master_list_rows
               WHERE upload_id = $1
               ORDER BY row_index ASC`,
              [activeUpload.id]
            )
          );

          let totalSent = 0;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const rows: { data: unknown }[] = await cursor.read(CURSOR_BATCH);
            if (rows.length === 0) break;

            const chunk = rows
              .map((r) => rowToCSVLine(colHeaders, r.data))
              .join("\r\n");
            controller.enqueue(new TextEncoder().encode(chunk + "\r\n"));

            totalSent += rows.length;
            if (totalSent >= MAX_EXPORT_ROWS) break;
          }

          await cursor.close();
          controller.close();
        } catch (err) {
          console.error("Export stream error:", err);
          if (cursor) { try { await cursor.close(); } catch { /* ignore */ } }
          controller.error(err);
        } finally {
          if (!released) {
            released = true;
            client.release();
          }
        }
      },
      cancel() {
        if (!released) {
          released = true;
          client.release();
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="masterlist_export_${Date.now()}.csv"`,
        "Transfer-Encoding": "chunked",
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
