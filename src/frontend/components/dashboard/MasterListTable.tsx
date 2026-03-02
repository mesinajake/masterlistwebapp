"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Pagination, TableSkeleton } from "@/frontend/components/ui";
import { TableToolbar } from "./TableToolbar";
import { ColumnFilter } from "./ColumnFilter";
import { useSearchStore } from "@/frontend/stores/searchStore";
import type { MasterListRow, MasterListResponse } from "@/shared/types/master-list";

/**
 * Format a value for display in a table cell.
 * Handles ISO dates, YYYY-MM-DD dates, and Excel serial date numbers.
 */
function formatCellValue(value: unknown, columnName?: string): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!str) return "";

  // Excel serial date conversion for columns whose name contains "date"
  if (
    typeof value === "number" &&
    columnName &&
    /date/i.test(columnName) &&
    value >= 1 &&
    value <= 73050
  ) {
    const utcMs = (value - 25569) * 86400000;
    const d = new Date(utcMs);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const h = d.getUTCHours();
      const min = d.getUTCMinutes();
      // Include time if the serial has a fractional part (non-midnight)
      if (h === 0 && min === 0) {
        return `${y}-${m}-${day}`;
      }
      return `${y}-${m}-${day} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }

  // Detect ISO 8601 dates: "2024-01-15T00:00:00.000Z"
  const isoMatch = str.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z?$/
  );
  if (isoMatch) {
    const [, y, m, d, hh, mm, ss] = isoMatch;
    if (hh === "00" && mm === "00" && ss === "00") {
      return `${y}-${m}-${d}`;
    }
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  // Already YYYY-MM-DD or YYYY-MM-DD HH:mm:ss — leave as-is
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(str)) {
    return str;
  }

  return str;
}

interface MasterListTableProps {
  data: MasterListResponse | undefined;
  columns: string[];
  isLoading: boolean;
  onExport: () => void;
  isExporting?: boolean;
}

export function MasterListTable({
  data,
  columns: columnHeaders,
  isLoading,
  onExport,
  isExporting,
}: MasterListTableProps) {
  const { page, filters, setPage, addFilter, removeFilter, clearFilters, setSort } =
    useSearchStore();
  const [showFilters, setShowFilters] = useState(false);
  const [sorting, setSortingState] = useState<SortingState>([]);

  // Convert filters array to Record<string, string> for ColumnFilter component
  const activeFilters = useMemo<Record<string, string>>(
    () => Object.fromEntries(filters.map((f) => [f.column, f.value])),
    [filters]
  );

  const handleFilterChange = (column: string, value: string) => {
    if (!value) {
      removeFilter(column);
    } else {
      addFilter({ column, value });
    }
  };

  // Build TanStack Table column definitions from dynamic headers
  const tableColumns = useMemo<ColumnDef<MasterListRow>[]>(
    () =>
      columnHeaders.map((header) => ({
        id: header,
        accessorFn: (row) => row.data[header] ?? "",
        header: () => (
          <div className="flex items-center gap-1 cursor-pointer hover:text-primary">
            {header}
            <span className="material-symbols-outlined text-[14px]">
              unfold_more
            </span>
          </div>
        ),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="text-text-primary-light dark:text-text-primary-dark">
              {formatCellValue(value, header)}
            </span>
          );
        },
      })),
    [columnHeaders]
  );

  const rows = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 };

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSortingState(newSorting);
      if (newSorting.length > 0) {
        setSort(newSorting[0].id, newSorting[0].desc ? "desc" : "asc");
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Master Data Overview
          </h2>
          <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {data?.pagination?.total != null
              ? `${data.pagination.total.toLocaleString()} records found`
              : "Browse and search the master list data."}
          </p>
        </div>
        <TableToolbar
          onExport={onExport}
          onToggleFilters={() => setShowFilters(!showFilters)}
          isExporting={isExporting}
        />
      </div>

      {/* Column Filters */}
      {showFilters && (
        <div className="mb-4">
          <ColumnFilter
            columns={columnHeaders}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
          />
        </div>
      )}

      {/* Table Container */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-bg-dark">
        {isLoading ? (
          <TableSkeleton rows={8} cols={columnHeaders.length || 5} />
        ) : rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <div className="text-center">
              <span className="material-symbols-outlined text-[48px] text-text-secondary-light/50">
                search_off
              </span>
              <p className="mt-2 text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                No results found
              </p>
              <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Try adjusting your search or filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="custom-scrollbar flex-1 overflow-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-surface-dark/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {/* Row index column */}
                    <th className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark w-[80px]">
                      #
                    </th>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-b border-border-light px-6 py-4 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark min-w-[160px]"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group hover:bg-blue-50/50 dark:hover:bg-primary/5 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-text-secondary-light dark:text-text-secondary-dark">
                      {row.original.rowIndex}
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-6 py-4 text-text-primary-light dark:text-text-primary-dark"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && rows.length > 0 && (
          <Pagination
            page={page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
