-- ============================================================
-- Migration 008: Fix bulk insert locks + search vector timeout
-- ============================================================
-- Problem 1: bulk_insert_rows() calls ALTER TABLE DISABLE/ENABLE TRIGGER
-- on every batch. With 3 concurrent batches, they fight for
-- AccessExclusive locks and timeout.
--
-- Problem 2: generate_search_vectors_batch() was missing SECURITY DEFINER,
-- so its SET statement_timeout = '300s' was IGNORED by PostgREST,
-- falling back to the default ~8s timeout.
--
-- Solution:
--   - Separate trigger management into its own functions
--   - Add SECURITY DEFINER to generate_search_vectors_batch
--   - Remove FOR UPDATE SKIP LOCKED (not needed for sequential processing)

-- 1. Disable the search_vector trigger (call once before all inserts)
CREATE OR REPLACE FUNCTION disable_search_trigger()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
BEGIN
  ALTER TABLE public.master_list_rows DISABLE TRIGGER trg_rows_search_vector;
END;
$$;

-- 2. Enable the search_vector trigger (call once after all inserts)
CREATE OR REPLACE FUNCTION enable_search_trigger()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
BEGIN
  ALTER TABLE public.master_list_rows ENABLE TRIGGER trg_rows_search_vector;
END;
$$;

-- 3. Replace bulk_insert_rows: NO trigger management, just inserts.
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
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- 4. Fix generate_search_vectors_batch: add SECURITY DEFINER so that
--    SET statement_timeout = '300s' actually takes effect via PostgREST.
--    Remove FOR UPDATE SKIP LOCKED (sequential processing is safer).
CREATE OR REPLACE FUNCTION generate_search_vectors_batch(
  p_upload_id UUID,
  p_batch_size INTEGER DEFAULT 5000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH batch AS (
    SELECT id, data
    FROM public.master_list_rows
    WHERE upload_id = p_upload_id
      AND search_vector IS NULL
    ORDER BY row_index
    LIMIT p_batch_size
  )
  UPDATE public.master_list_rows r
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
