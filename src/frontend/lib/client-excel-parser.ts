"use client";

/**
 * Client-side Excel parsing utility.
 * Uses SheetJS to parse Excel files directly in the browser,
 * converting them to CSV before uploading. This moves ~60-75 seconds
 * of CPU-intensive parsing from the server to the client.
 *
 * Benefits:
 * - Server receives CSV -> fast streaming parser -> COPY insert
 * - Password decryption happens client-side (no server-side crypto overhead)
 * - Progress feedback during parsing
 */

import * as XLSX from "xlsx";

export interface ClientParseResult {
  /** CSV blob ready for upload */
  csvBlob: Blob;
  /** Original file name with .csv extension */
  csvFileName: string;
  /** Approximate row count (excluding header) */
  rowCount: number;
  /** Sheet name that was parsed */
  sheetName: string;
}

export type ParseProgressCallback = (message: string) => void;

/**
 * Check if a file should be parsed client-side.
 * Excel files (.xlsx, .xls) benefit from client-side parsing.
 * CSV files are already in the right format -- upload directly.
 */
export function shouldParseClientSide(fileName: string): boolean {
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  return ext === ".xlsx" || ext === ".xls";
}

/**
 * Parse an Excel file client-side and return a CSV blob.
 * Uses SheetJS for fast parsing (3-4x faster than ExcelJS).
 *
 * @param file - The Excel file to parse
 * @param password - Optional password for encrypted files
 * @param onProgress - Progress callback for UI updates
 * @param signal - AbortSignal for cancellation
 */
export async function parseExcelClientSide(
  file: File,
  password?: string,
  onProgress?: ParseProgressCallback,
  signal?: AbortSignal
): Promise<ClientParseResult> {
  if (signal?.aborted) {
    throw new DOMException("Parsing cancelled", "AbortError");
  }

  onProgress?.("Reading file...");

  const buffer = await file.arrayBuffer();

  if (signal?.aborted) {
    throw new DOMException("Parsing cancelled", "AbortError");
  }

  onProgress?.("Parsing Excel structure...");

  // Allow React to render the progress state before blocking with SheetJS
  await new Promise((r) => setTimeout(r, 50));

  // Parse with SheetJS (synchronous but very fast -- 3-4x faster than ExcelJS)
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, {
    type: "array",
    cellDates: true,
    cellStyles: false,
    cellNF: false,
    cellHTML: false,
    password: password,
    dense: true,
  });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("No sheets found in Excel file");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Empty sheet");
  }

  if (signal?.aborted) {
    throw new DOMException("Parsing cancelled", "AbortError");
  }

  onProgress?.(`Converting sheet "${sheetName}" to CSV...`);

  // Allow React to render before CSV conversion
  await new Promise((r) => setTimeout(r, 10));

  // Convert to CSV
  const csv = XLSX.utils.sheet_to_csv(sheet, {
    blankrows: false,
    forceQuotes: true,
  });

  // Count rows (approximate)
  let rowCount = 0;
  for (let i = 0; i < csv.length; i++) {
    if (csv[i] === "\n") rowCount++;
  }
  if (rowCount > 0) rowCount--;

  const csvBlob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const csvFileName = `${baseName}.csv`;

  return {
    csvBlob,
    csvFileName,
    rowCount,
    sheetName,
  };
}
