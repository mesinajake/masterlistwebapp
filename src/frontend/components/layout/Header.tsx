"use client";

import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { UserMenu } from "./UserMenu";
import { Button } from "@/frontend/components/ui";
import { useAuthStore } from "@/frontend/stores/authStore";
import { useSearchStore } from "@/frontend/stores/searchStore";

export function Header() {
  const { user } = useAuthStore();
  const setQuery = useSearchStore((s) => s.setQuery);
  const isDAOrAbove = user?.role === "da" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-light bg-white px-6 py-2 dark:border-border-dark dark:bg-bg-dark shrink-0 z-20">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-4 w-64">
        <Link href="/" className="flex items-center gap-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-2xl">dataset</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
            MasterList
          </h1>
        </Link>
      </div>

      {/* Center: Search */}
      <SearchBar onSearch={setQuery} />

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-4 w-64 justify-end">
        <nav className="hidden md:flex items-center gap-6 mr-2">
          <Link
            href="/"
            className="text-sm font-medium text-text-secondary-light hover:text-primary transition-colors"
          >
            Overview
          </Link>
          <Link
            href="/history"
            className="text-sm font-medium text-text-secondary-light hover:text-primary transition-colors"
          >
            History
          </Link>
          {isSuperAdmin && (
            <Link
              href="/admin/users"
              className="text-sm font-medium text-text-secondary-light hover:text-primary transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {isDAOrAbove && (
          <Link href="/upload">
            <Button size="md">
              <span className="material-symbols-outlined text-[18px]">
                upload
              </span>
              <span>Upload</span>
            </Button>
          </Link>
        )}

        <div className="h-8 w-px bg-border-light dark:bg-border-dark mx-1" />

        <UserMenu />
      </div>
    </header>
  );
}
