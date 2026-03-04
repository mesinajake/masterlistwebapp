// ─── Shared Validators ───────────────────────────────

/** UUID v4 regex pattern */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Check if a string is a valid UUID */
export function isValidUUID(id: string): boolean {
  return UUID_RE.test(id);
}
