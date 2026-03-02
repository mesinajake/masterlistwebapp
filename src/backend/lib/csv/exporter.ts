// ─── CSV Exporter ─────────────────────────────────────

/**
 * Convert an array of row objects to a CSV string.
 * Handles quoting, commas, and newlines in values.
 * Includes UTF-8 BOM for Excel compatibility.
 */
export function rowsToCSV(
  headers: string[],
  rows: Record<string, unknown>[]
): string {
  const BOM = "\uFEFF";
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeCSVField).join(","));

  // Data rows
  for (const row of rows) {
    const values = headers.map((h) => escapeCSVField(String(row[h] ?? "")));
    lines.push(values.join(","));
  }

  return BOM + lines.join("\r\n");
}

/**
 * Escape a single CSV field.
 * Wraps in quotes if the value contains comma, quote, or newline.
 */
function escapeCSVField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
