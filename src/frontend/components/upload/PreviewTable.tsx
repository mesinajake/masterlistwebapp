"use client";

interface PreviewTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  /** When true, shows a subtle indicator that the upload is still in progress */
  isUploading?: boolean;
}

export function PreviewTable({ columns, rows, totalRows, isUploading }: PreviewTableProps) {
  return (
    <div className="rounded-xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-bg-dark overflow-hidden">
      <div className="border-b border-border-light bg-gray-50 px-6 py-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              Preview
            </h4>
            {isUploading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Uploading
              </span>
            )}
          </div>
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Showing {rows.length} of {totalRows.toLocaleString()} rows
          </span>
        </div>
      </div>
      <div className="overflow-auto max-h-96">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="sticky top-0 bg-gray-50 dark:bg-surface-dark/50">
            <tr>
              <th className="border-b border-border-light px-4 py-3 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark w-[60px]">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-border-light px-4 py-3 font-semibold text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-blue-50/50 dark:hover:bg-primary/5 transition-colors"
              >
                <td className="px-4 py-3 text-text-secondary-light dark:text-text-secondary-dark font-medium">
                  {idx + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-3 text-text-primary-light dark:text-text-primary-dark"
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
