import "server-only";

import ExcelJS from "exceljs";
import officeCrypto from "officecrypto-tool";
import { Readable } from "stream";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_ROWS,
  MAX_UPLOAD_COLUMNS,
} from "@/shared/utils/constants";
import { BadRequestError } from "@/backend/lib/utils/errors";

// ─── Types ────────────────────────────────────────────

/** A single batch yielded by the streaming parser */
export interface ParseBatch {
  headers: string[];
  batch: (string | number | boolean | null)[][];
  batchIndex: number;
  /** Cumulative count of rows parsed so far (across all batches) */
  totalParsed: number;
}

// ─── Helpers ──────────────────────────────────────────

function deduplicateHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const clean = (h ?? "").trim() || "Unnamed";
    const count = seen.get(clean) ?? 0;
    seen.set(clean, count + 1);
    return count === 0 ? clean : `${clean}_${count}`;
  });
}

/**
 * Convert an ExcelJS cell value to a simple string for header use.
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "object" && "richText" in value) {
    return (value.richText as Array<{ text: string }>)
      .map((r) => r.text)
      .join("")
      .trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellToString(value.result as ExcelJS.CellValue);
  }
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: string }).text).trim();
  }
  if (typeof value === "object" && "error" in value) {
    return "";
  }
  return String(value);
}

/**
 * Format a Date as YYYY-MM-DD or YYYY-MM-DD HH:mm:ss.
 * Uses UTC to avoid timezone shifts (Excel dates are timezone-less).
 */
function formatDate(d: Date): string {
  if (isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  const sec = d.getUTCSeconds();
  // If time is midnight, return date only
  if (h === 0 && min === 0 && sec === 0) {
    return `${y}-${m}-${day}`;
  }
  return `${y}-${m}-${day} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Check if a number falls in the plausible Excel serial date range.
 * Excel serial 1 = Jan 1, 1900; serial 73050 ≈ year 2100.
 */
function isPlausibleDateSerial(val: number): boolean {
  return val >= 1 && val <= 73050;
}

/**
 * Convert an Excel serial date number to a JavaScript Date (UTC).
 * Excel serial 1 = Jan 1, 1900. Handles the Excel 1900 leap-year bug.
 */
function excelSerialToDate(serial: number): Date {
  // Excel epoch: serial 25569 = Jan 1, 1970 (Unix epoch)
  // Fractional part represents time of day (0.5 = noon)
  const utcMs = (serial - 25569) * 86400000;
  return new Date(utcMs);
}

/**
 * Normalize an ExcelJS Cell to a DB-safe value.
 * Detects date-formatted cells via numFmt or column-name heuristic.
 */
function normalizeCellValue(
  cell: ExcelJS.Cell,
  headerName?: string
): string | number | boolean | null {
  const val = cell.value;
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val.trim();
  if (typeof val === "boolean") return val;
  if (val instanceof Date) return formatDate(val);

  if (typeof val === "number") {
    // Column header contains "date" → likely a date serial
    // (numFmt detection skipped — styles set to "ignore" for performance)
    if (headerName && /date/i.test(headerName) && isPlausibleDateSerial(val)) {
      return formatDate(excelSerialToDate(val));
    }
    return val;
  }

  // Rich text
  if (typeof val === "object" && "richText" in val) {
    return (val.richText as Array<{ text: string }>)
      .map((r) => r.text)
      .join("")
      .trim();
  }
  // Formula result
  if (typeof val === "object" && "result" in val) {
    const result = val.result as ExcelJS.CellValue;
    if (result === null || result === undefined) return null;
    if (typeof result === "string") return result.trim();
    if (typeof result === "boolean") return result;
    if (result instanceof Date) return formatDate(result);
    if (typeof result === "number") {
      // Column-name heuristic for date detection
      // (numFmt detection skipped — styles set to "ignore" for performance)
      if (headerName && /date/i.test(headerName) && isPlausibleDateSerial(result)) {
        return formatDate(excelSerialToDate(result));
      }
      return result;
    }
    return String(result);
  }
  // Hyperlink
  if (typeof val === "object" && "text" in val) {
    return String((val as { text: string }).text).trim();
  }
  // Error
  if (typeof val === "object" && "error" in val) {
    return null;
  }
  return String(val);
}

// ─── Streaming Parser ─────────────────────────────────

/**
 * Streaming version of parseExcelBuffer.
 * Yields batches of rows as they are parsed, enabling concurrent
 * parse + insert instead of loading all rows into memory first.
 *
 * @param buffer – raw file bytes
 * @param fileName – original filename (for validation)
 * @param password – optional password for encrypted files
 * @param batchSize – rows per batch (default 10,000)
 */
export async function* parseExcelBufferStreaming(
  buffer: ArrayBuffer,
  fileName: string,
  password?: string,
  batchSize: number = 10_000
): AsyncGenerator<ParseBatch> {
  const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new BadRequestError(
      `Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`
    );
  }

  // Convert to Buffer for officecrypto-tool compatibility
  let fileBuffer = Buffer.from(buffer);

  console.log("[parser:stream] File size:", fileBuffer.length, "bytes");

  // Decrypt if needed
  const encrypted = officeCrypto.isEncrypted(fileBuffer);
  console.log("[parser:stream] isEncrypted:", encrypted);

  if (encrypted) {
    if (!password) {
      throw new BadRequestError(
        "This file is password-protected. Please provide the password."
      );
    }
    try {
      console.log("[parser:stream] Attempting decryption...");
      const decryptedBuf = await officeCrypto.decrypt(fileBuffer, { password });
      fileBuffer = Buffer.from(decryptedBuf);
      console.log("[parser:stream] Decryption successful, size:", fileBuffer.length, "bytes");
    } catch (decryptError) {
      const msg =
        decryptError instanceof Error
          ? decryptError.message
          : String(decryptError);
      console.error("[parser:stream] Decryption failed:", msg);
      if (/password|incorrect|invalid|wrong|decrypt/i.test(msg)) {
        throw new BadRequestError(
          "Incorrect password. Please check and try again."
        );
      }
      throw new BadRequestError(
        "Failed to decrypt the file. Please verify the password and try again."
      );
    }
  }

  // Stream parse with ExcelJS
  console.log("[parser:stream] Starting streaming parse...");
  const readableStream = Readable.from(fileBuffer);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(readableStream, {
    sharedStrings: "cache",
    hyperlinks: "ignore",   // Skip hyperlink parsing (~5% faster)
    worksheets: "emit",
    entries: "emit",
    styles: "ignore",       // Skip numFmt/style parsing (~10-15% faster)
  });

  let headers: string[] = [];
  let batch: (string | number | boolean | null)[][] = [];
  let totalParsed = 0;
  let batchIndex = 0;
  let headersParsed = false;
  let firstSheetProcessed = false;

  for await (const worksheetReader of workbookReader) {
    if (firstSheetProcessed) break;

    console.log("[parser:stream] Processing sheet:",
      (worksheetReader as unknown as { name?: string }).name ?? "Sheet1");
    let rowIndex = 0;

    for await (const row of worksheetReader) {
      rowIndex++;

      if (rowIndex === 1) {
        // First row = headers
        const rawHeaders: string[] = [];
        const cellCount = row.cellCount;
        for (let c = 1; c <= cellCount; c++) {
          const cell = row.getCell(c);
          rawHeaders.push(cellToString(cell.value));
        }
        while (rawHeaders.length > 0 && !rawHeaders[rawHeaders.length - 1]) {
          rawHeaders.pop();
        }
        if (rawHeaders.length === 0) {
          throw new BadRequestError("No column headers found");
        }
        if (rawHeaders.length > MAX_UPLOAD_COLUMNS) {
          throw new BadRequestError(
            `Too many columns (${rawHeaders.length}). Maximum is ${MAX_UPLOAD_COLUMNS}.`
          );
        }
        headers = deduplicateHeaders(rawHeaders);
        headersParsed = true;
        console.log("[parser:stream] Headers:", headers.length, "columns");
        continue;
      }

      // Data rows
      if (totalParsed >= MAX_UPLOAD_ROWS) {
        throw new BadRequestError(
          `Too many rows (exceeded ${MAX_UPLOAD_ROWS.toLocaleString()}). Maximum is ${MAX_UPLOAD_ROWS.toLocaleString()}.`
        );
      }

      const record: (string | number | boolean | null)[] = [];
      for (let c = 0; c < headers.length; c++) {
        const cell = row.getCell(c + 1);
        record.push(normalizeCellValue(cell, headers[c]));
      }
      batch.push(record);
      totalParsed++;

      // Yield batch when full
      if (batch.length >= batchSize) {
        console.log(`[parser:stream] Yielding batch ${batchIndex} (${totalParsed} rows parsed so far)`);
        yield { headers, batch, batchIndex, totalParsed };
        batch = [];
        batchIndex++;
      }
    }

    firstSheetProcessed = true;
  }

  if (!headersParsed || headers.length === 0) {
    throw new BadRequestError("No column headers found in the first sheet");
  }

  // Yield final partial batch
  if (batch.length > 0) {
    console.log(`[parser:stream] Yielding final batch ${batchIndex} (${batch.length} rows, ${totalParsed} total)`);
    yield { headers, batch, batchIndex, totalParsed };
  }

  if (totalParsed === 0) {
    throw new BadRequestError("Excel file is empty or contains only headers");
  }

  console.log("[parser:stream] Streaming parse complete:", totalParsed, "rows");
}

/**
 * Normalize any cell value to a DB-safe type (legacy, used for headers).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeValue(
  val: ExcelJS.CellValue
): string | number | boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val;
  if (val instanceof Date) return formatDate(val);
  if (typeof val === "object" && "richText" in val) {
    return (val.richText as Array<{ text: string }>)
      .map((r) => r.text)
      .join("")
      .trim();
  }
  if (typeof val === "object" && "result" in val) {
    return normalizeValue(val.result as ExcelJS.CellValue);
  }
  if (typeof val === "object" && "text" in val) {
    return String((val as { text: string }).text).trim();
  }
  if (typeof val === "object" && "error" in val) {
    return null;
  }
  return String(val);
}
