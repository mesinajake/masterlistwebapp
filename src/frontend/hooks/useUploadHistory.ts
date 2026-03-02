"use client";

import { useQuery } from "@tanstack/react-query";
import type { Upload } from "@/shared/types/upload";

export function useUploadHistory() {
  return useQuery<Upload[]>({
    queryKey: ["uploads"],
    queryFn: async () => {
      const res = await fetch("/api/uploads");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch upload history");
      }
      const data = await res.json();
      return data.uploads;
    },
    staleTime: 60 * 1000,
  });
}
