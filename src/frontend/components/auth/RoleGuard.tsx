"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/frontend/stores/authStore";
import type { UserRole } from "@/shared/types/user";

/** Role hierarchy: super_admin > da > agent */
const ROLE_LEVEL: Record<UserRole, number> = {
  super_admin: 3,
  da: 2,
  agent: 1,
};

interface RoleGuardProps {
  children: ReactNode;
  requiredRole: UserRole;
  fallbackUrl?: string;
}

/** Redirects if user does not meet the required role (hierarchical check) */
export function RoleGuard({
  children,
  requiredRole,
  fallbackUrl = "/",
}: RoleGuardProps) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  const hasAccess =
    user != null && ROLE_LEVEL[user.role] >= ROLE_LEVEL[requiredRole];

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      router.replace(fallbackUrl);
    }
  }, [isLoading, user, hasAccess, fallbackUrl, router]);

  if (isLoading || !user || !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
