import { NextRequest, NextResponse } from "next/server";
import { requireDA, isPayload } from "@/backend/lib/auth/middleware";
import { execute, rpc, queryOne } from "@/backend/lib/db";

// ─── Constants ────────────────────────────────────────
const SV_BATCH_SIZE = 50_000;

// Dedicated internal secret — NEVER reuse the JWT signing key
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * POST /api/uploads/[id]/vectorize
 *
 * Background search vector generation for an upload.
 * Called automatically after upload completes.
 * Generates search vectors in 50K batches, rebuilds GIN index,
 * and updates the upload's vector_status.
 *
 * Auth: requires DA/super_admin session OR internal secret header.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth: accept either a valid DA session or an internal secret
  const internalToken = request.headers.get("x-internal-secret");
  // Timing-safe comparison to prevent secret leakage via timing attacks
  let isInternalCall = false;
  if (INTERNAL_SECRET && internalToken && INTERNAL_SECRET.length === internalToken.length) {
    const { timingSafeEqual } = await import("crypto");
    isInternalCall = timingSafeEqual(
      Buffer.from(INTERNAL_SECRET),
      Buffer.from(internalToken)
    );
  }

  if (!isInternalCall) {
    const authResult = await requireDA(request);
    if (!isPayload(authResult)) return authResult;
  }

  const uploadId = params.id;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(uploadId)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Invalid upload ID" },
      { status: 400 }
    );
  }

  // Verify upload exists and get row count
  const { data: upload, error: fetchError } = await queryOne<{
    id: string;
    row_count: number;
    vector_status: string;
  }>(
    "SELECT id, row_count, vector_status FROM master_list_uploads WHERE id = $1",
    [uploadId]
  );

  if (fetchError || !upload) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Upload not found" },
      { status: 404 }
    );
  }

  // Skip if already complete or processing
  if (upload.vector_status === "complete") {
    return NextResponse.json({
      success: true,
      message: "Vectors already complete",
      vectorStatus: "complete",
    });
  }

  if (upload.vector_status === "processing") {
    // H-5 fix: Check if vectorization has been stuck for too long (> 10 min)
    // If so, allow retry by treating it as failed
    const { data: startCheck } = await queryOne<{ minutes_ago: number }>(
      `SELECT EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 AS minutes_ago
       FROM master_list_uploads WHERE id = $1`,
      [uploadId]
    );
    const minutesAgo = startCheck?.minutes_ago ?? 0;
    if (minutesAgo < 10) {
      return NextResponse.json({
        success: true,
        message: "Vectorization already in progress",
        vectorStatus: "processing",
      });
    }
    // Stale "processing" — allow retry
    console.log(`[vectorize] Stale processing state detected (${Math.round(minutesAgo)} min). Retrying...`);
  }

  // Mark as processing
  await execute(
    "UPDATE master_list_uploads SET vector_status = 'processing' WHERE id = $1",
    [uploadId]
  );

  try {
    const totalRows = upload.row_count;
    console.log(`[vectorize] Starting vectorization for upload ${uploadId} (${totalRows} rows)`);

    // ── Generate search vectors in batches ──────────────────
    let svGenerated = 0;

    while (true) {
      const { data: updated, error: svError } = await rpc<number>(
        "generate_search_vectors_batch",
        {
          p_upload_id: uploadId,
          p_batch_size: SV_BATCH_SIZE,
        }
      );

      if (svError) {
        console.error("[vectorize] Search vector error:", svError.message);
        await execute(
          "UPDATE master_list_uploads SET vector_status = 'failed' WHERE id = $1",
          [uploadId]
        );
        return NextResponse.json(
          { error: "VECTORIZE_ERROR", message: "Search vector generation failed" },
          { status: 500 }
        );
      }

      const batchCount = (updated as number) ?? 0;
      svGenerated += batchCount;

      if (batchCount === 0) break;

      const pct = Math.min(100, Math.round((svGenerated / totalRows) * 100));
      console.log(`[vectorize] Progress: ${svGenerated} / ${totalRows} (${pct}%)`);
    }

    // ── Rebuild GIN index (ensure it exists — it is never dropped now) ──
    console.log("[vectorize] Ensuring GIN index exists...");
    await execute(
      "CREATE INDEX IF NOT EXISTS idx_rows_search_vector ON master_list_rows USING GIN (search_vector)"
    );

    // ── Re-enable search trigger ───────────────────────────
    const { error: enableErr } = await rpc("enable_search_trigger");
    if (enableErr) {
      console.error("[vectorize] Could not re-enable trigger:", enableErr.message);
    }

    // Mark as complete
    await execute(
      "UPDATE master_list_uploads SET vector_status = 'complete' WHERE id = $1",
      [uploadId]
    );

    console.log(`[vectorize] ✓ Vectorization complete for upload ${uploadId}: ${svGenerated} vectors generated`);

    return NextResponse.json({
      success: true,
      vectorStatus: "complete",
      vectorsGenerated: svGenerated,
    });
  } catch (error) {
    console.error("[vectorize] Unexpected error:", error);

    // Mark as failed
    await execute(
      "UPDATE master_list_uploads SET vector_status = 'failed' WHERE id = $1",
      [uploadId]
    );

    // Try to rebuild GIN index in case it was dropped
    try {
      await execute(
        "CREATE INDEX IF NOT EXISTS idx_rows_search_vector ON master_list_rows USING GIN (search_vector)"
      );
    } catch { /* ignore */ }

    try {
      await rpc("enable_search_trigger");
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Vectorization failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/uploads/[id]/vectorize
 * Check vectorization status for an upload.
 * Requires DA or super_admin authentication.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireDA(request);
  if (!isPayload(authResult)) return authResult;

  const uploadId = params.id;

  const { data: upload, error } = await queryOne<{
    vector_status: string;
    row_count: number;
  }>(
    "SELECT vector_status, row_count FROM master_list_uploads WHERE id = $1",
    [uploadId]
  );

  if (error || !upload) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Upload not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    vectorStatus: upload.vector_status,
    rowCount: upload.row_count,
  });
}
