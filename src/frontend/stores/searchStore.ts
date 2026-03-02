import { create } from "zustand";

interface ColumnFilter {
  column: string;
  value: string;
}

interface SearchState {
  query: string;
  filters: ColumnFilter[];
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortOrder: "asc" | "desc";

  setQuery: (query: string) => void;
  addFilter: (filter: ColumnFilter) => void;
  removeFilter: (column: string) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (column: string, order: "asc" | "desc") => void;
  clearSort: () => void;
  reset: () => void;
}

const initialState = {
  query: "",
  filters: [] as ColumnFilter[],
  page: 1,
  pageSize: 25,
  sortBy: null as string | null,
  sortOrder: "asc" as const,
};

export const useSearchStore = create<SearchState>((set) => ({
  ...initialState,

  setQuery: (query) => set({ query, page: 1 }),

  addFilter: (filter) =>
    set((state) => {
      const existing = state.filters.findIndex(
        (f) => f.column === filter.column
      );
      const filters =
        existing >= 0
          ? state.filters.map((f, i) => (i === existing ? filter : f))
          : [...state.filters, filter];
      return { filters, page: 1 };
    }),

  removeFilter: (column) =>
    set((state) => ({
      filters: state.filters.filter((f) => f.column !== column),
      page: 1,
    })),

  clearFilters: () => set({ filters: [], page: 1 }),

  setPage: (page) => set({ page }),

  setPageSize: (pageSize) => set({ pageSize, page: 1 }),

  setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),

  clearSort: () => set({ sortBy: null, sortOrder: "asc" }),

  reset: () => set(initialState),
}));
