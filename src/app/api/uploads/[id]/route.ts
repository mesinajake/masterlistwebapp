import { NextRequest, NextResponse } from "next/server";
import { requireDA, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne, execute, getClient } from "@/backend/lib/db";
import { removeFiles } from "@/backend/lib/storage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Batch size for chunked row deletion (avoids giant single-transaction locks). */
const DELETE_BATCH_SIZE = 50_000;

/**
 * DELETE /api/uploads/[id]
 * Delete an upload and all its associated rows.
 * Rows are deleted in batches to keep transactions short and reduce
 * WAL pressure / GIN-index maintenance cost for 300K+ row uploads.
 * Cannot delete the currently active upload. DA or Super Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireDA(request);
  if (!isPayload(authResult)) return authResult;

  const uploadId = params.id;

  if (!UUID_RE.test(uploadId)) {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Invalid upload ID format" },
      { status: 400 }
    );
  }

  try {
    // Verify the upload exists
    const { data: upload, error: fetchError } = await queryOne<{
      id: string;
      is_active: boolean;
      file_name: string;
      row_count: number;
      storage_path: string;
    }>(
      "SELECT id, is_active, file_name, row_count, storage_path FROM master_list_uploads WHERE id = $1",
      [uploadId]
    );

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Upload not found" },
        { status: 404 }
      );
    }

    if (upload.is_active) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message:
            "Cannot delete the active upload. Activate a different upload first.",
        },
        { status: 403 }
      );
    }

    // ── Batched row deletion ──────────────────────────────────
    // Delete rows in chunks of DELETE_BATCH_SIZE using ctid sub-select.
    // Each batch auto-commits (no wrapping BEGIN/COMMIT), keeping locks
    // short and allowing the GIN index to be updated incrementally.
    const client = await getClient();
    let totalDeleted = 0;

    try {
      // Set a generous statement timeout per batch (60s should be plenty for 50K rows)
      await client.query("SET statement_timeout = '60s'");

      let batchDeleted: number;
      do {
        const result = await client.query(
          `DELETE FROM master_list_rows
           WHERE ctid IN (
             SELECT ctid FROM master_list_rows
             WHERE upload_id = $1
             LIMIT $2
           )`,
          [uploadId, DELETE_BATCH_SIZE]
        );
        batchDeleted = result.rowCount ?? 0;
        totalDeleted += batchDeleted;
      } while (batchDeleted >= DELETE_BATCH_SIZE);

      // Delete the upload record (rows are gone, safe to remove parent)
      await client.query(
        "DELETE FROM master_list_uploads WHERE id = $1",
        [uploadId]
      );
    } finally {
      client.release();
    }

    console.log(`[delete] Deleted upload ${uploadId} with ${totalDeleted} rows`);

    // ── Post-delete cleanup (parallel, non-critical) ─────────
    const cleanupPromises: Promise<void>[] = [];

    // Storage file
    if (upload.storage_path) {
      cleanupPromises.push(
        removeFiles("master-list-files", [upload.storage_path])
          .then(({ error }) => {
            if (error) console.error("Storage delete error:", error);
          })
      );
    }

    // Audit log
    cleanupPromises.push(
      execute(
        `INSERT INTO audit_log (user_id, action, target_id, metadata) VALUES ($1, $2, $3, $4)`,
        [
          authResult.sub,
          "delete",
          uploadId,
          JSON.stringify({
            file_name: upload.file_name,
            row_count: upload.row_count,
            rows_deleted: totalDeleted,
          }),
        ]
      ).then(({ error }) => {
        if (error) console.error("Audit log error:", error);
      })
    );

    await Promise.allSettled(cleanupPromises);

    return NextResponse.json({
      success: true,
      deletedUploadId: uploadId,
      rowsDeleted: totalDeleted,
    });
  } catch (error) {
    console.error("DELETE /api/uploads/[id] error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
