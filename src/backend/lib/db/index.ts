import "server-only";

import { Pool, type PoolClient } from "pg";

// ── Singleton connection pool ───────────────────────────────
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing DATABASE_URL environment variable");
    }
    _pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // Log pool errors (don't crash the process)
    _pool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err.message);
    });
  }
  return _pool;
}

// ── Query helpers ───────────────────────────────────────────

export interface QueryResult<T = Record<string, unknown>> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

export interface SingleResult<T = Record<string, unknown>> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Execute a parameterized SQL query.
 * Returns `{ data, error }` matching the Supabase result pattern.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  try {
    const pool = getPool();
    const result = await pool.query(text, params);
    return { data: result.rows as T[], error: null, count: result.rowCount ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error("[db] Query error:", message);
    return { data: null, error: { message, code } };
  }
}

/**
 * Execute a query and return the first row.
 * Returns `{ data, error }` where data is a single object or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<SingleResult<T>> {
  try {
    const pool = getPool();
    const result = await pool.query(text, params);
    return { data: (result.rows[0] as T) ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error("[db] QueryOne error:", message);
    return { data: null, error: { message, code } };
  }
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE).
 * Returns `{ data, error, count }`.
 */
export async function execute(
  text: string,
  params?: unknown[]
): Promise<{ data: null; error: { message: string; code?: string } | null; count: number }> {
  try {
    const pool = getPool();
    const result = await pool.query(text, params);
    return { data: null, error: null, count: result.rowCount ?? 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error("[db] Execute error:", message);
    return { data: null, error: { message, code }, count: 0 };
  }
}

/**
 * Call a PostgreSQL function (RPC).
 * Returns `{ data, error }` where data is the function result.
 */
export async function rpc<T = unknown>(
  functionName: string,
  args: Record<string, unknown> = {}
): Promise<SingleResult<T>> {
  try {
    // C-2 fix: Validate function name and arg keys against SQL identifier pattern
    // to prevent SQL injection via interpolated identifiers
    const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
    if (!SAFE_IDENTIFIER.test(functionName)) {
      throw new Error(`Invalid function name: ${functionName}`);
    }
    const pool = getPool();
    const keys = Object.keys(args);
    for (const key of keys) {
      if (!SAFE_IDENTIFIER.test(key)) {
        throw new Error(`Invalid argument key: ${key}`);
      }
    }
    const placeholders = keys.map((k, i) => `${k} := $${i + 1}`).join(", ");
    const values = keys.map((k) => args[k]);
    const sql = keys.length > 0
      ? `SELECT ${functionName}(${placeholders}) AS result`
      : `SELECT ${functionName}() AS result`;
    const result = await pool.query(sql, values);
    const raw = result.rows[0]?.result;
    return { data: raw as T, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(`[db] RPC ${functionName} error:`, message);
    return { data: null, error: { message, code } };
  }
}

/**
 * Get a client from the pool for transaction use.
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Gracefully close the pool (for app shutdown).
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ── Graceful shutdown ─────────────────────────────────────

// Register shutdown handlers to drain the pool on process exit.
// This prevents orphaned in-flight queries when the server stops.
if (typeof process !== "undefined") {
  const shutdown = async (signal: string) => {
    console.log(`[db] Received ${signal}, draining pool...`);
    await closePool();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ── Startup health checks ─────────────────────────────────

let _healthCheckDone = false;

/**
 * Run startup health checks on first use.
 * - Ensures search trigger is enabled (fixes crash-recovery state)
 * - Cleans orphaned staging table data
 * Runs once, then no-ops on subsequent calls.
 */
export async function runStartupHealthChecks(): Promise<void> {
  if (_healthCheckDone) return;
  _healthCheckDone = true;

  try {
    // C-3: Ensure search trigger is enabled (may have been left disabled by crash)
    const pool = getPool();
    const triggerResult = await pool.query(
      "SELECT ensure_search_trigger_enabled() AS enabled"
    );
    const enabled = triggerResult.rows[0]?.enabled;
    if (enabled) {
      console.log("[db:health] Search trigger verified as enabled");
    } else {
      console.warn("[db:health] Search trigger not found — search may not work");
    }

    // M-5: Clean orphaned staging rows (left behind by server crashes during upload)
    const cleanResult = await pool.query(
      "DELETE FROM master_list_rows_staging WHERE TRUE"
    );
    if ((cleanResult.rowCount ?? 0) > 0) {
      console.log(`[db:health] Cleaned ${cleanResult.rowCount} orphaned staging rows`);
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error("[db:health] Startup health check failed:", err);
  }
}
