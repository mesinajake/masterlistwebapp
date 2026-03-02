import { NextRequest, NextResponse } from "next/server";
import { requireDA, requireAuth, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne, query, execute, rpc, getClient } from "@/backend/lib/db";
import { uploadFile } from "@/backend/lib/storage";
import { parseExcelBufferStreaming } from "@/backend/lib/excel/parser";
import { AppError } from "@/backend/lib/utils/errors";
import {
  MAX_UPLOAD_SIZE,
  PREVIEW_ROW_COUNT,
} from "@/shared/utils/constants";
import { from as copyFrom } from "pg-copy-streams";
import type { PoolClient } from "pg";

// Allow large request bodies for file uploads (App Router route segment config)
export const runtime = "nodejs";
export const maxDuration = 600; // seconds — increased for large files

// ─── Constants ────────────────────────────────────────
const COPY_BATCH_SIZE = 50_000;     // Rows per COPY batch (larger = fewer round-trips)
const SV_BATCH_SIZE = 50_000;       // Search vector generation batch size (increased from 10K)
const STORAGE_LIMIT = 50 * 1024 * 1024; // 50 MB — skip storage for larger files

/**
 * POST /api/uploads
 * Upload a new Excel file, parse it, store rows, return preview.
 * 
 * OPTIMIZED PIPELINE:
 * 1. Stream-parse Excel in batches of 10K rows
 * 2. COPY each batch directly into PostgreSQL (bypasses SQL parsing overhead)
 * 3. Generate search vectors in 50K-row batches
 * 4. Rebuild GIN index in one pass (faster than incremental maintenance)
 * 
 * This is ~3-5x faster than the previous RPC-based JSON serialization approach.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireDA(request);
  if (!isPayload(authResult)) return authResult;

  // ── Validate file ───────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Invalid form data" },
      { status: 400 }
    );
  }

  const fileField = formData.get("file");
  if (!fileField || !(fileField instanceof File)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "No file provided" },
      { status: 400 }
    );
  }

  const file = fileField;
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      {
        error: "BAD_REQUEST",
        message: `File too large. Maximum: ${MAX_UPLOAD_SIZE / (1024 * 1024)} MB`,
      },
      { status: 400 }
    );
  }

  const passwordField = formData.get("password");
  const password =
    typeof passwordField === "string" && passwordField.length > 0
      ? passwordField
      : undefined;

  // ── Create streaming response ───────────────────────────────
  const transformStream = new TransformStream();
  const writer = transformStream.writable.getWriter();
  const encoder = new TextEncoder();

  const emit = async (
    stage: string,
    progress: number,
    detail?: string,
    data?: unknown
  ) => {
    const event = JSON.stringify({ stage, progress, detail, ...(data ? { data } : {}) });
    await writer.write(encoder.encode(event + "\n"));
  };

  // Process in background — the streaming response starts immediately
  (async () => {
    let uploadId: string | null = null;
    let indexDropped = false;
    let triggerDisabled = false;
    let client: PoolClient | null = null;

    try {
      // ── Stage 1: Read file ──────────────────────────────────
      await emit("parsing", 0, "Reading file...");
      const fileArrayBuffer = await file.arrayBuffer();

      // Storage upload (small files only — skip for large files)
      const safeName = file.name
        .replace(/[/\\:*?"<>|]/g, "_")
        .replace(/\.\./g, "_")
        .slice(0, 100);
      const storagePath = `uploads/${Date.now()}_${safeName}`;
      if (file.size <= STORAGE_LIMIT) {
        await uploadFile("master-list-files", storagePath, fileArrayBuffer);
      }

      // ── Stage 2: Stream parse + COPY insert ─────────────────
      await emit("parsing", 10, "Parsing and inserting rows...");

      let headers: string[] = [];
      let totalInserted = 0;
      let totalParsed = 0;
      let globalRowOffset = 0;
      const previewRows: (string | number | boolean | null)[][] = [];

      client = await getClient();

      try {
        for await (const parseBatch of parseExcelBufferStreaming(
          fileArrayBuffer,
          file.name,
          password,
          COPY_BATCH_SIZE
        )) {
          headers = parseBatch.headers;
          totalParsed = parseBatch.totalParsed;

          // Collect preview rows from early batches
          if (previewRows.length < PREVIEW_ROW_COUNT) {
            const needed = PREVIEW_ROW_COUNT - previewRows.length;
            previewRows.push(...parseBatch.batch.slice(0, needed));
          }

          // First batch: create upload record + prepare table
          if (parseBatch.batchIndex === 0) {
            const { data: uploadRecord, error: uploadError } = await queryOne<{ id: string }>(
              `INSERT INTO master_list_uploads
                 (uploaded_by, file_name, storage_path, is_active, row_count, column_headers)
               VALUES ($1, $2, $3, false, 0, $4)
               RETURNING id`,
              [authResult.sub, file.name, storagePath, JSON.stringify(headers)]
            );

            if (uploadError || !uploadRecord) {
              console.error("[upload] Failed to create upload record:", uploadError?.message);
              await emit("error", 0, `Failed to create upload record: ${uploadError?.message || "unknown"}`);
              await writer.close();
              return;
            }

            uploadId = uploadRecord.id;
            console.log(`[upload] Upload record created: ${uploadId}`);

            // Disable search_vector trigger (prevents per-row trigger overhead)
            await client.query("SELECT disable_search_trigger()");
            triggerDisabled = true;

            // Drop GIN index for faster bulk inserts (~20-30% speedup)
            await client.query("DROP INDEX IF EXISTS idx_rows_search_vector");
            indexDropped = true;

            await emit("inserting", 0, "Inserting rows...");
          }

          if (parseBatch.batch.length === 0) continue;

          // ── COPY this batch directly into the table ──
          // COPY FROM STDIN is 3-5x faster than INSERT via RPC/JSON
          const copyStream = client.query(
            copyFrom(
              "COPY master_list_rows (upload_id, row_index, data) FROM STDIN WITH (FORMAT csv)"
            )
          );

          // Write rows as CSV: uuid,row_index,"json_data"
          for (let i = 0; i < parseBatch.batch.length; i++) {
            const rowIdx = globalRowOffset + i + 1; // 1-based row index
            const jsonStr = JSON.stringify(parseBatch.batch[i]);
            // CSV-escape: double all quotes inside the JSON field
            const csvEscaped = jsonStr.replace(/"/g, '""');
            const line = `${uploadId},${rowIdx},"${csvEscaped}"\n`;

            if (!copyStream.write(line)) {
              // Back-pressure: wait for drain before writing more
              await new Promise<void>((resolve) => copyStream.once("drain", resolve));
            }
          }

          // End COPY stream and wait for PostgreSQL acknowledgment
          await new Promise<void>((resolve, reject) => {
            copyStream.on("finish", resolve);
            copyStream.on("error", reject);
            copyStream.end();
          });

          globalRowOffset += parseBatch.batch.length;
          totalInserted += parseBatch.batch.length;

          const pct = Math.min(99, Math.round((totalInserted / Math.max(totalParsed, totalInserted + 1)) * 90));
          console.log(`[upload] COPY batch ${parseBatch.batchIndex}: ${parseBatch.batch.length} rows (total: ${totalInserted})`);
          await emit(
            "inserting",
            pct,
            `Inserted ${totalInserted.toLocaleString()} rows`
          );
        }
      } finally {
        // Release the pool client regardless of success/failure
        if (client) {
          client.release();
          client = null;
        }
      }

      // Update upload record with actual row count
      await execute(
        "UPDATE master_list_uploads SET row_count = $1 WHERE id = $2",
        [totalParsed, uploadId]
      );

      console.log(`[upload] All ${totalInserted} rows inserted via COPY`);
      await emit("inserting", 100, `Inserted ${totalInserted.toLocaleString()} rows`);

      // ── Stage 3: Generate search vectors ────────────────────
      // Using larger 50K batches (vs previous 10K) to reduce round-trip overhead
      console.log(`[upload] Generating search vectors for ${totalInserted} rows...`);
      await emit("vectors", 0, `Generating search vectors (0 / ${totalInserted.toLocaleString()})...`);

      let svGenerated = 0;
      let svDone = false;

      while (!svDone) {
        const { data: updated, error: svError } = await rpc<number>(
          "generate_search_vectors_batch",
          {
            p_upload_id: uploadId,
            p_batch_size: SV_BATCH_SIZE,
          }
        );

        if (svError) {
          console.error("[upload] Search vector error:", svError.message);
          await emit("vectors", -1, `Search vector generation failed: ${svError.message}. Data uploaded but search may not work.`);
          svDone = true;
          break;
        }

        const batchCount = (updated as number) ?? 0;
        svGenerated += batchCount;

        if (batchCount === 0) {
          svDone = true;
        }

        const svPct = Math.min(100, Math.round((svGenerated / totalInserted) * 100));
        console.log(`[upload] Search vectors: ${svGenerated} / ${totalInserted} (${svPct}%)`);
        await emit(
          "vectors",
          svPct,
          `Search vectors: ${svGenerated.toLocaleString()} / ${totalInserted.toLocaleString()} rows`
        );
      }

      // ── Stage 4: Rebuild GIN index in one pass ──────────────
      // Bulk index creation is dramatically faster than incremental
      // maintenance during inserts
      console.log("[upload] Rebuilding GIN index...");
      await emit("indexing", 0, "Rebuilding search index...");
      await execute(
        "CREATE INDEX idx_rows_search_vector ON master_list_rows USING GIN (search_vector)"
      );
      indexDropped = false;
      await emit("indexing", 100, "Search index rebuilt");

      // Re-enable search trigger
      const { error: enableErr } = await rpc("enable_search_trigger");
      if (enableErr) {
        console.error("[upload] Could not re-enable trigger:", enableErr.message);
      }
      triggerDisabled = false;

      // ── Audit log ─────────────────────────────────────────
      await execute(
        `INSERT INTO audit_log (user_id, action, target_id, metadata) VALUES ($1, $2, $3, $4)`,
        [
          authResult.sub,
          "upload",
          uploadId,
          JSON.stringify({
            file_name: file.name,
            row_count: totalParsed,
            columns: headers,
          }),
        ]
      );

      // ── Final result ──────────────────────────────────────
      const previewData = previewRows.slice(0, PREVIEW_ROW_COUNT).map((row) => {
        const obj: Record<string, string | number | boolean | null> = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx] ?? null;
        });
        return obj;
      });

      console.log(`[upload] ✓ Upload complete: ${totalParsed} rows, upload ID: ${uploadId}`);
      await emit("complete", 100, "Upload complete", {
        uploadId,
        fileName: file.name,
        rowCount: totalParsed,
        columns: headers,
        preview: previewData,
        status: "pending_confirmation",
      });

      await writer.close();
    } catch (error) {
      // ── Error cleanup ──────────────────────────────────────
      if (client) {
        try { client.release(); } catch { /* ignore */ }
        client = null;
      }

      // Clean up partial data
      if (uploadId) {
        try {
          await execute("DELETE FROM master_list_rows WHERE upload_id = $1", [uploadId]);
          await execute("DELETE FROM master_list_uploads WHERE id = $1", [uploadId]);
          console.log(`[upload] Cleaned up partial upload ${uploadId}`);
        } catch (cleanupErr) {
          console.error("[upload] Cleanup failed:", cleanupErr);
        }
      }

      // Rebuild dropped index
      if (indexDropped) {
        try {
          await execute(
            "CREATE INDEX IF NOT EXISTS idx_rows_search_vector ON master_list_rows USING GIN (search_vector)"
          );
          console.log("[upload] Rebuilt GIN index after error");
        } catch { /* ignore — index may already exist */ }
      }

      // Re-enable trigger
      if (triggerDisabled) {
        try {
          await rpc("enable_search_trigger");
          console.log("[upload] Re-enabled trigger after error");
        } catch { /* ignore */ }
      }

      const message =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred";
      console.error("POST /api/uploads error:", message);

      try {
        await emit("error", 0, message);
        await writer.close();
      } catch {
        // Writer may already be closed
      }
    }
  })();

  return new NextResponse(transformStream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

/**
 * GET /api/uploads
 * List upload history. All authenticated users.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!isPayload(authResult)) return authResult;

  try {
    const { data: uploads, error } = await query<{
      id: string;
      file_name: string;
      row_count: number;
      is_active: boolean;
      column_headers: string[];
      created_at: string;
      uploaded_by: string;
      uploader_id: string;
      uploader_name: string;
    }>(
      `SELECT
         u.id,
         u.file_name,
         u.row_count,
         u.is_active,
         u.column_headers,
         u.created_at,
         u.uploaded_by,
         usr.id AS uploader_id,
         usr.name AS uploader_name
       FROM master_list_uploads u
       LEFT JOIN users usr ON usr.id = u.uploaded_by
       ORDER BY u.created_at DESC`
    );

    if (error) {
      console.error("Upload history query error:", error);
      return NextResponse.json(
        { error: "QUERY_ERROR", message: error.message },
        { status: 500 }
      );
    }

    const result = (uploads ?? []).map((u) => ({
      id: u.id,
      fileName: u.file_name,
      rowCount: u.row_count,
      isActive: u.is_active,
      columnHeaders: u.column_headers ?? [],
      uploadedBy: {
        id: u.uploader_id ?? "",
        name: u.uploader_name ?? "Unknown",
      },
      createdAt: u.created_at,
    }));

    return NextResponse.json({ uploads: result });
  } catch (error) {
    console.error("GET /api/uploads error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
