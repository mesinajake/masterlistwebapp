// ─── CSV Exporter ─────────────────────────────────────

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
 * Build a single CSV row string from a JSONB data value.
 * Handles both array and object formats.
 */
export function rowToCSVLine(
  headers: string[],
  rawData: unknown
): string {
  if (Array.isArray(rawData)) {
    return headers
      .map((_, i) => escapeCSVField(String((rawData as unknown[])[i] ?? "")))
      .join(",");
  }
  const obj = rawData as Record<string, unknown>;
  return headers
    .map((h) => escapeCSVField(String(obj[h] ?? "")))
    .join(",");
}

/**
 * Build the CSV header line with BOM prefix.
 */
export function csvHeaderLine(headers: string[]): string {
  return "\uFEFF" + headers.map(escapeCSVField).join(",");
}
