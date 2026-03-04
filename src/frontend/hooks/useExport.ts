"use client";

import { useCallback, useState } from "react";
import { useSearchStore } from "@/frontend/stores/searchStore";
import { toast } from "sonner";

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { query, filters } = useSearchStore();

  const exportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      filters.forEach((f) => {
        params.append("filter", `${f.column}:${f.value}`);
      });

      const res = await fetch(`/api/master-list/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message || "Export failed"
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extract filename from Content-Disposition header or use default
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] || `master-list-export-${Date.now()}.csv`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [query, filters]);

  return { exportCSV, isExporting };
}
