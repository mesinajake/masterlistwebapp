"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthGuard } from "@/frontend/components/auth/AuthGuard";
import { RoleGuard } from "@/frontend/components/auth/RoleGuard";
import { Header } from "@/frontend/components/layout/Header";
import { Badge } from "@/frontend/components/ui/Badge";
import { Avatar } from "@/frontend/components/ui";
import { TableSkeleton } from "@/frontend/components/ui/Skeleton";
import { toast } from "sonner";
import type { UserRole } from "@/shared/types/user";

interface UserRecord {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

const ROLE_BADGE: Record<UserRole, { label: string; variant: "purple" | "blue" | "green" }> = {
  super_admin: { label: "Super Admin", variant: "purple" },
  da: { label: "Data Admin", variant: "blue" },
  agent: { label: "Agent", variant: "green" },
};

export default function AdminUsersPage() {
  return (
    <AuthGuard>
      <RoleGuard requiredRole="super_admin" fallbackUrl="/">
        <AdminUsersContent />
      </RoleGuard>
    </AuthGuard>
  );
}

function AdminUsersContent() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to fetch users");
      }
      const { data } = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setChangingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to update role");
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success("Role updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setChangingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <Header />

      <main className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark">
            User Management
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Manage user roles and permissions
          </p>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">
              Failed to load users
            </p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">
              {error}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    User
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    Joined
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const badge = ROLE_BADGE[u.role];
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={u.avatar_url}
                            name={u.name}
                            size="sm"
                          />
                          <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
                            {u.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary-light dark:text-text-secondary-dark">
                        {u.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-text-secondary-light dark:text-text-secondary-dark">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value as UserRole)
                          }
                          disabled={changingId === u.id}
                          className="text-sm rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-bg-dark text-text-primary-light dark:text-text-primary-dark px-2 py-1 disabled:opacity-50"
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="da">Data Admin</option>
                          <option value="agent">Agent</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-text-secondary-light dark:text-text-secondary-dark"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
