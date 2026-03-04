"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthGuard } from "@/frontend/components/auth/AuthGuard";
import { RoleGuard } from "@/frontend/components/auth/RoleGuard";
import { Header } from "@/frontend/components/layout/Header";
import { Avatar } from "@/frontend/components/ui/Avatar";
import { Badge } from "@/frontend/components/ui/Badge";
import { Button } from "@/frontend/components/ui";
import { TableSkeleton } from "@/frontend/components/ui/Skeleton";

interface Activity {
  id: string;
  action: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    name: string;
    email: string | null;
    avatarUrl: string | null;
  };
}

interface ActivityResponse {
  activities: Activity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: string; badge: "blue" | "green" | "red" | "orange" | "purple" }
> = {
  upload: { label: "Uploaded", icon: "upload_file", badge: "blue" },
  activate: { label: "Activated", icon: "check_circle", badge: "green" },
  delete: { label: "Deleted", icon: "delete", badge: "red" },
  login: { label: "Logged in", icon: "login", badge: "purple" },
  logout: { label: "Logged out", icon: "logout", badge: "orange" },
};

const ACTION_FILTERS = [
  { value: "", label: "All Activities" },
  { value: "upload", label: "Uploads" },
  { value: "activate", label: "Activations" },
  { value: "delete", label: "Deletions" },
  { value: "login", label: "Logins" },
  { value: "logout", label: "Logouts" },
];

export default function ActivityPage() {
  return (
    <AuthGuard>
      <RoleGuard requiredRole="super_admin">
        <ActivityContent />
      </RoleGuard>
    </AuthGuard>
  );
}

function ActivityContent() {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const pageSize = 25;

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/admin/activity?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to fetch activities");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDescription = (activity: Activity): string => {
    const meta = activity.metadata;
    if (!meta) return "";

    switch (activity.action) {
      case "upload":
        return `"${meta.file_name}" — ${Number(meta.row_count).toLocaleString()} rows, ${(meta.columns as string[])?.length ?? 0} columns`;
      case "activate":
        return `Activated upload "${meta.file_name}"`;
      case "delete":
        return `Deleted "${meta.file_name}" — ${Number(meta.row_count).toLocaleString()} rows removed`;
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <Header />

      <main className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark">
              Activity Log
            </h1>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
              Track all user activities — uploads, deletions, and activations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {ACTION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-8 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          </div>
        ) : !data || data.activities.length === 0 ? (
          <div className="rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-text-secondary-light dark:text-text-secondary-dark mb-2 block">
              history
            </span>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              No activities found
            </p>
          </div>
        ) : (
          <>
            {/* Activity list */}
            <div className="bg-white dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark divide-y divide-border-light dark:divide-border-dark max-h-[600px] overflow-y-auto">
              {data.activities.map((activity) => {
                const config = ACTION_CONFIG[activity.action] ?? {
                  label: activity.action,
                  icon: "info",
                  badge: "gray" as const,
                };
                const description = getDescription(activity);

                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-bg-dark/50 transition-colors"
                  >
                    {/* User avatar */}
                    <Avatar
                      src={activity.user.avatarUrl}
                      name={activity.user.name}
                      size="sm"
                    />

                    {/* Activity details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                          {activity.user.name}
                        </span>
                        <Badge variant={config.badge}>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">
                              {config.icon}
                            </span>
                            {config.label}
                          </span>
                        </Badge>
                      </div>
                      {description && (
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">
                          {description}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                      {formatDate(activity.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Showing {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, data.total)} of{" "}
                  {data.total.toLocaleString()} activities
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
