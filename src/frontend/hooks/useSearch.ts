"use client";

import { useCallback } from "react";
import { useSearchStore } from "@/frontend/stores/searchStore";

export function useSearch() {
  const {
    query,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
    setQuery,
    addFilter,
    removeFilter,
    clearFilters,
    setPage,
    setPageSize,
    setSort,
    clearSort,
    reset,
  } = useSearchStore();

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
    },
    [setQuery]
  );

  return {
    query,
    filters,
    page,
    pageSize,
    sortBy,
    sortOrder,
    search: handleSearch,
    addFilter,
    removeFilter,
    clearFilters,
    setPage,
    setPageSize,
    setSort,
    clearSort,
    reset,
  };
}
