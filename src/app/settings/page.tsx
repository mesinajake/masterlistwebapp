"use client";

import { AuthGuard } from "@/frontend/components/auth/AuthGuard";
import { RoleGuard } from "@/frontend/components/auth/RoleGuard";
import { Header } from "@/frontend/components/layout/Header";
import { useAuth } from "@/frontend/hooks/useAuth";
import { useUIStore } from "@/frontend/stores/uiStore";
import { Badge } from "@/frontend/components/ui/Badge";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <RoleGuard requiredRole="da">
        <SettingsContent />
      </RoleGuard>
    </AuthGuard>
  );
}

function SettingsContent() {
  const { user } = useAuth();
  const { theme, setTheme } = useUIStore();

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <Header />

      <main className="max-w-[800px] mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark">
            Settings
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Manage your preferences
          </p>
        </div>

        {/* Profile Section */}
        <section className="bg-white dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-6 mb-6">
          <h2 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark mb-4">
            Profile
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Name
              </span>
              <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                {user?.name || "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Email
              </span>
              <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                {user?.email || "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                Role
              </span>
              <Badge variant={user?.role === "super_admin" ? "purple" : user?.role === "da" ? "blue" : "green"}>
                {user?.role === "super_admin" ? "Super Admin" : user?.role === "da" ? "DA" : "Agent"}
              </Badge>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="bg-white dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark p-6">
          <h2 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark mb-4">
            Appearance
          </h2>
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  theme === t
                    ? "bg-primary text-white"
                    : "bg-surface-light dark:bg-bg-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
