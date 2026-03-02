"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/frontend/components/ui";
import { useAuth } from "@/frontend/hooks/useAuth";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-full ring-2 ring-transparent hover:ring-primary/20 transition-all"
        aria-label="User menu"
      >
        <Avatar src={user.avatarUrl} name={user.name} showOnline />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border-light bg-white shadow-lg dark:border-border-dark dark:bg-bg-dark z-50">
          <div className="border-b border-border-light dark:border-border-dark px-4 py-3">
            <p className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {user.name}
            </p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {user.email ?? user.role.toUpperCase()}
            </p>
            <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {user.role === "super_admin"
                ? "Super Admin"
                : user.role === "da"
                  ? "Data Admin"
                  : "Agent"}
            </span>
          </div>
          <div className="py-1">
            <a
              href="/settings"
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary-light hover:bg-gray-50 dark:text-text-secondary-dark dark:hover:bg-surface-dark"
            >
              <span className="material-symbols-outlined text-[18px]">
                settings
              </span>
              Settings
            </a>
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <span className="material-symbols-outlined text-[18px]">
                logout
              </span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
