import "server-only";

import fs from "fs/promises";
import path from "path";

/**
 * Local file storage — replaces Supabase Storage.
 * Files are stored under `./storage/` in the project root.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage");

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Upload a file to local storage.
 * Validates the resolved path stays within STORAGE_ROOT to prevent path traversal.
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  data: Buffer | ArrayBuffer
): Promise<{ error: { message: string } | null }> {
  try {
    const fullPath = path.resolve(STORAGE_ROOT, bucket, filePath);
    if (!fullPath.startsWith(STORAGE_ROOT)) {
      return { error: { message: "Invalid file path: directory traversal detected" } };
    }
    const fullDir = path.dirname(fullPath);
    await ensureDir(fullDir);
    const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : data;
    await fs.writeFile(fullPath, buffer);
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[storage] Upload error:", message);
    return { error: { message } };
  }
}

/**
 * Delete file(s) from local storage.
 * Validates each path stays within STORAGE_ROOT to prevent path traversal.
 */
export async function removeFiles(
  bucket: string,
  filePaths: string[]
): Promise<{ error: { message: string } | null }> {
  try {
    for (const fp of filePaths) {
      const fullPath = path.resolve(STORAGE_ROOT, bucket, fp);
      if (!fullPath.startsWith(STORAGE_ROOT)) {
        console.error(`[storage] Path traversal blocked: ${fp}`);
        continue;
      }
      await fs.unlink(fullPath).catch(() => {
        // Ignore if file doesn't exist
      });
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[storage] Remove error:", message);
    return { error: { message } };
  }
}
