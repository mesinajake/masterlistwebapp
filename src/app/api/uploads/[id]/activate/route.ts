import { NextRequest, NextResponse } from "next/server";
import { requireDA, isPayload } from "@/backend/lib/auth/middleware";
import { queryOne, execute, getClient } from "@/backend/lib/db";

/**
 * POST /api/uploads/[id]/activate
 * Set a specific upload as the active Master List.
 * Deactivates all other uploads. Requires DA or super_admin role.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireDA(request);
  if (!isPayload(authResult)) return authResult;

  const uploadId = params.id;

  // Validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
      row_count: number;
    }>(
      "SELECT id, row_count FROM master_list_uploads WHERE id = $1",
      [uploadId]
    );

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Upload not found" },
        { status: 404 }
      );
    }

    // Use a real transaction for atomic activation
    const client = await getClient();
    try {
      await client.query("BEGIN");

      // Deactivate all uploads
      await client.query(
        "UPDATE master_list_uploads SET is_active = false WHERE is_active = true"
      );

      // Activate the target upload
      await client.query(
        "UPDATE master_list_uploads SET is_active = true WHERE id = $1",
        [uploadId]
      );

      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK");
      console.error("Activation transaction error:", txError);
      return NextResponse.json(
        { error: "DB_ERROR", message: "Failed to activate upload" },
        { status: 500 }
      );
    } finally {
      client.release();
    }

    // Write audit log (non-blocking, but log errors)
    const { error: auditError } = await execute(
      `INSERT INTO audit_log (user_id, action, target_id, metadata) VALUES ($1, $2, $3, $4)`,
      [
        authResult.sub,
        "activate",
        uploadId,
        JSON.stringify({ row_count: upload.row_count }),
      ]
    );
    if (auditError) {
      console.error("Audit log error:", auditError);
    }

    return NextResponse.json({
      success: true,
      activatedUploadId: uploadId,
      rowCount: upload.row_count,
    });
  } catch (error) {
    console.error("POST /api/uploads/[id]/activate error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
