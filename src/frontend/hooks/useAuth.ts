"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/frontend/stores/authStore";
import type { User } from "@/shared/types/user";

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, logout } =
    useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading: queryLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!queryLoading) {
      setUser(data ?? null);
    }
  }, [data, queryLoading, setUser]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return {
    user,
    isLoading: isLoading || queryLoading,
    isAuthenticated,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
