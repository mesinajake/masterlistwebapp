"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/frontend/hooks/useAuth";
import { TableSkeleton } from "@/frontend/components/ui";

interface AuthGuardProps {
  children: ReactNode;
}

/** Redirects to /login if user is not authenticated */
export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <TableSkeleton />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
