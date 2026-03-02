"use client";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="border-t border-border-light bg-gray-50 px-6 py-3 dark:border-border-dark dark:bg-surface-dark flex items-center justify-between">
      <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Showing{" "}
        <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
          {total === 0 ? 0 : start}-{end}
        </span>{" "}
        of{" "}
        <span className="font-medium text-text-primary-light dark:text-text-primary-dark">
          {total}
        </span>{" "}
        results
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center justify-center rounded-md border border-border-light bg-white px-3 py-1 text-sm font-medium text-text-secondary-light hover:bg-gray-50 hover:text-primary disabled:opacity-50 dark:border-border-dark dark:bg-bg-dark dark:text-text-secondary-dark"
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center justify-center rounded-md border border-border-light bg-white px-3 py-1 text-sm font-medium text-text-secondary-light hover:bg-gray-50 hover:text-primary disabled:opacity-50 dark:border-border-dark dark:bg-bg-dark dark:text-text-secondary-dark"
        >
          Next
        </button>
      </div>
    </div>
  );
}
