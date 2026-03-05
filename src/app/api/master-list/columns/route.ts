import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne } from "@/backend/lib/db";
import { apiRateLimiter } from "@/backend/lib/security/rate-limit";

/**
 * GET /api/master-list/columns
 * Return column headers of the active upload.
 * Adapts dynamically to whatever file was uploaded.
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
    const { data: activeUpload } = await queryOne<{
      id: string;
      column_headers: string[];
    }>(
      "SELECT id, column_headers FROM master_list_uploads WHERE is_active = true",
      []
    );

    if (!activeUpload) {
      return NextResponse.json({
        columns: [],
        uploadId: null,
      });
    }

    // Use column_headers if available (set during upload)
    let columns = activeUpload.column_headers ?? [];

    // Fallback: if column_headers is empty, extract keys from the first row
    if (columns.length === 0) {
      const { data: firstRow } = await queryOne<{ data: unknown }>(
        `SELECT data FROM master_list_rows
         WHERE upload_id = $1
         ORDER BY row_index ASC
         LIMIT 1`,
        [activeUpload.id]
      );

      if (firstRow?.data && typeof firstRow.data === "object" && !Array.isArray(firstRow.data)) {
        columns = Object.keys(firstRow.data as Record<string, unknown>);
      }
    }

    return NextResponse.json({
      columns,
      uploadId: activeUpload.id,
    });
  } catch (error) {
    console.error("GET /api/master-list/columns error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
