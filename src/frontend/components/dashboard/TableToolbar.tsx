"use client";

import { Button } from "@/frontend/components/ui";

interface TableToolbarProps {
  onExport: () => void;
  onToggleFilters: () => void;
  isExporting?: boolean;
}

export function TableToolbar({
  onExport,
  onToggleFilters,
  isExporting,
}: TableToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={onToggleFilters}>
        <span className="material-symbols-outlined text-[18px]">
          filter_list
        </span>
        Filters
      </Button>
      <Button
        variant="secondary"
        onClick={onExport}
        isLoading={isExporting}
      >
        <span className="material-symbols-outlined text-[18px]">
          download
        </span>
        Export
      </Button>
    </div>
  );
}
