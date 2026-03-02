"use client";

interface PreviewTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export function PreviewTable({ columns, rows, totalRows }: PreviewTableProps) {
  return (
    <div className="rounded-xl border border-border-light bg-white shadow-sm dark:border-border-dark dark:bg-bg-dark overflow-hidden">
      <div className="border-b border-border-light bg-gray-50 px-6 py-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Preview
          </h4>
          <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            Showing {rows.length} of {totalRows} rows
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
