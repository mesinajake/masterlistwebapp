-- ============================================================
-- Migration 014: Fix critical issues found in audit
--
-- C-1: Fix generate_search_vectors_batch (012 broke it with row_data)
-- C-2: Add updated_at column to master_list_uploads
-- C-3: Startup-safe trigger check function
-- L-1: Drop unused SECURITY DEFINER functions
-- ============================================================

-- ─── C-1: Fix generate_search_vectors_batch ────────────────────
-- Migration 012 replaced this function and used 'r.row_data' instead
-- of the correct 'data' column. This broke all vectorization.
-- Restore the correct version from 008 with 012's security improvements.
CREATE OR REPLACE FUNCTION generate_search_vectors_batch(
  p_upload_id UUID,
  p_batch_size INT DEFAULT 10000
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  updated_count INT;
BEGIN
  WITH batch AS (
    SELECT id, data
    FROM master_list_rows
    WHERE upload_id = p_upload_id
      AND search_vector IS NULL
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE master_list_rows r
  SET search_vector = (
    CASE jsonb_typeof(batch.data)
      WHEN 'array' THEN
        to_tsvector('simple', COALESCE(
          (SELECT string_agg(COALESCE(elem, ''), ' ')
           FROM jsonb_array_elements_text(batch.data) AS elem),
          ''
        ))
      ELSE
        to_tsvector('simple', COALESCE(
          (SELECT string_agg(COALESCE(value, ''), ' ')
           FROM jsonb_each_text(batch.data)),
          ''
        ))
    END
  )
  FROM batch
  WHERE r.id = batch.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ─── C-2: Add updated_at to master_list_uploads ────────────────
-- Required for stale vectorization detection (>10 min check).
ALTER TABLE public.master_list_uploads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Auto-update the timestamp on any UPDATE
CREATE OR REPLACE FUNCTION update_uploads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uploads_updated_at ON master_list_uploads;
CREATE TRIGGER trg_uploads_updated_at
  BEFORE UPDATE ON master_list_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_uploads_updated_at();

-- ─── C-3: Function to check and fix trigger state ──────────────
-- Called at app startup to ensure the search trigger is enabled.
-- Prevents permanent trigger-disabled state after crashes.
CREATE OR REPLACE FUNCTION ensure_search_trigger_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trigger_enabled TEXT;
BEGIN
  SELECT tgenabled INTO trigger_enabled
  FROM pg_trigger
  WHERE tgname = 'trg_rows_search_vector'
    AND tgrelid = 'master_list_rows'::regclass;

  IF trigger_enabled IS NULL THEN
    -- Trigger doesn't exist at all
    RETURN FALSE;
  END IF;

  IF trigger_enabled = 'D' THEN
    -- Trigger is disabled — re-enable it
    ALTER TABLE master_list_rows ENABLE TRIGGER trg_rows_search_vector;
    RETURN TRUE; -- Was disabled, now re-enabled
  END IF;

  RETURN TRUE; -- Already enabled
END;
$$;

-- ─── L-1: Drop unused SECURITY DEFINER functions ───────────────
-- These are no longer called by the application (upload uses COPY,
-- delete uses batched ctid deletion).
DROP FUNCTION IF EXISTS bulk_insert_master_list_rows(UUID, JSONB);
DROP FUNCTION IF EXISTS delete_upload_rows(UUID, INT);

-- Also drop the broken 012 filter_master_list overload (different signature,
-- never called, references non-existent row_data column).
-- Signature: (TEXT, JSONB, TEXT, TEXT, INT, INT)
DROP FUNCTION IF EXISTS filter_master_list(TEXT, JSONB, TEXT, TEXT, INT, INT);

-- Drop broken update_search_vector_fn from 012 (references row_data)
DROP FUNCTION IF EXISTS update_search_vector_fn();

-- Drop broken get_column_values overload from 012 (references row_data)
-- Signature: (TEXT, UUID) — different from 009's (TEXT, UUID, INT)
DROP FUNCTION IF EXISTS get_column_values(TEXT, UUID);

-- Drop unused release_upload_lock from 012 (uses wrong pg_advisory_unlock)
DROP FUNCTION IF EXISTS release_upload_lock();
