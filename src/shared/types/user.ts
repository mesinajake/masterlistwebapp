// ─── User Types ───────────────────────────────────────

export type UserRole = "super_admin" | "da" | "agent";

export interface User {
  id: string;
  larkUserId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserRow {
  id: string;
  lark_user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/** Convert a DB row to a client-facing User object */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    larkUserId: row.lark_user_id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
