-- ============================================================
-- Migration 006: Bulk insert RPC + Array-format search vector
-- ============================================================

-- 1. Bulk insert function: accepts rows as a JSONB array of arrays.
--    DISABLES the search_vector trigger during insert for performance.
--    Uses SECURITY DEFINER to run as table owner (can ALTER TABLE).
--    Search vectors are generated separately afterward.
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
  -- Disable search vector trigger for bulk performance
  ALTER TABLE public.master_list_rows DISABLE TRIGGER trg_rows_search_vector;

  INSERT INTO public.master_list_rows (upload_id, row_index, data)
  SELECT
    p_upload_id,
    p_offset + ordinality::INTEGER,
    value
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Re-enable trigger (always, even if error occurs via EXCEPTION block)
  ALTER TABLE public.master_list_rows ENABLE TRIGGER trg_rows_search_vector;

  RETURN inserted_count;
EXCEPTION WHEN OTHERS THEN
  -- Re-enable trigger on error
  ALTER TABLE public.master_list_rows ENABLE TRIGGER trg_rows_search_vector;
  RAISE;
END;
$$;

-- 2. Generate search vectors in batches (called AFTER all rows inserted).
--    Processes a batch of rows that have NULL search_vector.
CREATE OR REPLACE FUNCTION generate_search_vectors_batch(
  p_upload_id UUID,
  p_batch_size INTEGER DEFAULT 5000
)
RETURNS INTEGER
LANGUAGE plpgsql
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
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
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

-- 3. Update search_vector trigger to handle BOTH array and object formats
--    (for single-row inserts/updates outside of bulk operations).
CREATE OR REPLACE FUNCTION generate_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  combined_text TEXT := '';
  val TEXT;
BEGIN
  IF jsonb_typeof(NEW.data) = 'array' THEN
    FOR val IN SELECT jsonb_array_elements_text(NEW.data)
    LOOP
      combined_text := combined_text || ' ' || COALESCE(val, '');
    END LOOP;
  ELSE
    FOR val IN SELECT value FROM jsonb_each_text(NEW.data)
    LOOP
      combined_text := combined_text || ' ' || COALESCE(val, '');
    END LOOP;
  END IF;

  NEW.search_vector := to_tsvector('simple', combined_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
