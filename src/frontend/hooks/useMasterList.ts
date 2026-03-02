"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchStore } from "@/frontend/stores/searchStore";
import type { MasterListResponse } from "@/shared/types/master-list";

export function useMasterList() {
  const { query, filters, page, pageSize, sortBy, sortOrder } =
    useSearchStore();

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  if (query) params.set("search", query);
  if (sortBy) {
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
  }

  filters.forEach((f) => {
    params.append("filter", `${f.column}:${f.value}`);
  });

  return useQuery<MasterListResponse>({
    queryKey: ["master-list", query, filters, page, pageSize, sortBy, sortOrder],
    queryFn: async () => {
      const res = await fetch(`/api/master-list?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch master list");
      }
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  });
}
