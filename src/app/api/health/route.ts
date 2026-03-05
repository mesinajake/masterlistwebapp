import { NextResponse } from "next/server";
import { query } from "@/backend/lib/db";
import { statSync, readdirSync } from "fs";
import { join } from "path";

/**
 * GET /api/health
 * 
 * Public health check endpoint for monitoring and PM2.
 * Returns server status, database connectivity, uptime, and memory usage.
 * 
 * No authentication required — intended for uptime monitors,
 * load balancers, and deployment health checks.
 * 
 * Security: DB error details are sanitized (no connection strings or internal details).
 */
export async function GET() {
  const startTime = Date.now();

  // ── Database check ──────────────────────────────────────
  let dbStatus: "ok" | "error" = "error";
  let dbLatencyMs = 0;
  let dbError: string | undefined;

  try {
    const dbStart = Date.now();
    const { error } = await query("SELECT 1 AS ping");
    dbLatencyMs = Date.now() - dbStart;
    if (error) {
      // Sanitize: don't expose internal DB error details to unauthenticated users
      dbError = "Database query failed";
      console.error("[health] DB check error:", error.message);
    } else {
      dbStatus = "ok";
    }
  } catch (err) {
    // Sanitize: generic message only
    dbError = "Database unreachable";
    console.error("[health] DB check exception:", err instanceof Error ? err.message : err);
  }

  // ── Storage check ───────────────────────────────────────
  let storageMB = 0;
  try {
    const storageDir = join(process.cwd(), "storage", "master-list-files", "uploads");
    const files = readdirSync(storageDir).filter(f => !f.startsWith("."));
    for (const file of files) {
      try {
        const stat = statSync(join(storageDir, file));
        storageMB += stat.size;
      } catch { /* skip unreadable files */ }
    }
    storageMB = Math.round(storageMB / 1024 / 1024);
  } catch {
    // Storage directory may not exist yet — that's fine
    storageMB = 0;
  }

  // ── Memory usage ────────────────────────────────────────
  const mem = process.memoryUsage();
  const formatMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

  // ── Overall status ──────────────────────────────────────
  const isHealthy = dbStatus === "ok";
  const totalLatencyMs = Date.now() - startTime;

  const body = {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
    },
    memory: {
      rss: `${formatMB(mem.rss)} MB`,
      heapUsed: `${formatMB(mem.heapUsed)} MB`,
      heapTotal: `${formatMB(mem.heapTotal)} MB`,
      external: `${formatMB(mem.external)} MB`,
    },
    storage: {
      uploadedFilesMB: storageMB,
    },
    latencyMs: totalLatencyMs,
  };

  return NextResponse.json(body, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
