import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isPayload } from "@/backend/lib/auth/middleware";
import { query } from "@/backend/lib/db";

interface AuditRow {
  id: string;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user_name: string;
  user_email: string | null;
  user_avatar: string | null;
}

/**
 * GET /api/admin/activity
 * Fetch audit log entries with user info. Super admin only.
 * Query params: ?page=1&pageSize=50&action=upload
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isPayload(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10)));
  const actionFilter = searchParams.get("action"); // optional: upload | activate | delete | login | logout
  const offset = (page - 1) * pageSize;

  let whereClause = "";
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (actionFilter && ["upload", "activate", "delete", "login", "logout"].includes(actionFilter)) {
    whereClause = `WHERE a.action = $${paramIdx}`;
    params.push(actionFilter);
    paramIdx++;
  }

  // Get total count
  const { data: countResult } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_log a ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.[0]?.count || "0", 10);

  // Get paginated results
  const { data, error } = await query<AuditRow>(
    `SELECT
       a.id,
       a.action,
       a.target_id,
       a.metadata,
       a.created_at,
       u.name AS user_name,
       u.email AS user_email,
       u.avatar_url AS user_avatar
     FROM audit_log a
     JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, pageSize, offset]
  );

  if (error) {
    console.error("[admin/activity] GET error:", error.message);
    return NextResponse.json(
      { error: "DB_ERROR", message: "Failed to fetch activity log" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    activities: (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      user: {
        name: row.user_name,
        email: row.user_email,
        avatarUrl: row.user_avatar,
      },
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
