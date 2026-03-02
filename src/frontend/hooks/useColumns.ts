"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnsResponse } from "@/shared/types/master-list";

export function useColumns() {
  return useQuery<ColumnsResponse>({
    queryKey: ["columns"],
    queryFn: async () => {
      const res = await fetch("/api/master-list/columns");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch columns");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
