-- ============================================================
-- Migration 009: Prevent duplicate rows & fix trigger for arrays
-- ============================================================
-- Problem 1: bulk_insert_rows retries can insert duplicate rows
--            because there's no UNIQUE constraint on (upload_id, row_index).
--
-- Problem 2: The per-row trigger generate_search_vector() uses
--            jsonb_each_text() which doesn't work for array-format JSONB.
--
-- Solution:
--   - Add UNIQUE constraint on (upload_id, row_index)
--   - Update bulk_insert_rows to use ON CONFLICT DO NOTHING
--   - Update trigger to handle both array and object JSONB

-- 1. Add unique constraint (the existing index idx_rows_upload_id_row_index
--    is a regular btree; we need a UNIQUE one for ON CONFLICT)
-- First, drop the old non-unique index and recreate as unique constraint:
DROP INDEX IF EXISTS public.idx_rows_upload_id_row_index;
ALTER TABLE public.master_list_rows
  ADD CONSTRAINT uq_rows_upload_row_index UNIQUE (upload_id, row_index);

-- 2. Update bulk_insert_rows with ON CONFLICT DO NOTHING
--    This makes retries idempotent — if a batch partially inserted
--    before a timeout, the retry skips already-inserted rows.
CREATE OR REPLACE FUNCTION bulk_insert_rows(
  p_upload_id UUID,
  p_rows JSONB,
  p_offset INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.master_list_rows (upload_id, row_index, data)
  SELECT
    p_upload_id,
    p_offset + ordinality::INTEGER,
    value
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY
  ON CONFLICT (upload_id, row_index) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- 3. Update the per-row trigger to handle array JSONB
--    (fires for manual row inserts/updates when trigger is enabled)
CREATE OR REPLACE FUNCTION generate_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  combined_text TEXT := '';
  val TEXT;
BEGIN
  IF jsonb_typeof(NEW.data) = 'array' THEN
    -- Array format: concatenate all array elements
    FOR val IN SELECT elem FROM jsonb_array_elements_text(NEW.data) AS elem
    LOOP
      combined_text := combined_text || ' ' || COALESCE(val, '');
    END LOOP;
  ELSE
    -- Object format: concatenate all values
    FOR val IN SELECT value FROM jsonb_each_text(NEW.data)
    LOOP
      combined_text := combined_text || ' ' || COALESCE(val, '');
    END LOOP;
  END IF;

  NEW.search_vector := to_tsvector('simple', TRIM(combined_text));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
