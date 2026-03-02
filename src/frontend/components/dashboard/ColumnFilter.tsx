"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/frontend/components/ui";

interface ColumnFilterProps {
  columns: string[];
  activeFilters: Record<string, string>;
  onFilterChange: (column: string, value: string) => void;
  onClearFilters: () => void;
}

export function ColumnFilter({
  columns,
  activeFilters,
  onFilterChange,
  onClearFilters,
}: ColumnFilterProps) {
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when a column is selected
  useEffect(() => {
    if (selectedColumn && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedColumn]);

  const handleApply = () => {
    if (selectedColumn && filterValue.trim()) {
      onFilterChange(selectedColumn, filterValue.trim());
      setFilterValue("");
    }
  };

  const activeCount = Object.keys(activeFilters).length;

  return (
    <div className="rounded-lg border border-border-light bg-white p-4 shadow-sm dark:border-border-dark dark:bg-bg-dark">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Column Filters
          {activeCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {activeCount}
            </span>
          )}
        </h4>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear all
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedColumn}
          onChange={(e) => setSelectedColumn(e.target.value)}
          className="min-w-[180px] rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm text-text-primary-light dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Select column...</option>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="text"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          placeholder={selectedColumn ? `Filter by ${selectedColumn}...` : "Select a column first..."}
          disabled={!selectedColumn}
          className="min-w-[200px] flex-1 rounded-lg border border-border-light bg-surface-light px-3 py-2 text-sm text-text-primary-light placeholder-text-secondary-light disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!selectedColumn || !filterValue.trim()}
        >
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
          Apply
        </Button>
      </div>
    </div>
  );
}
