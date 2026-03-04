-- ═══════════════════════════════════════════════════════════════════
-- Migration 012: Security Fixes
-- ═══════════════════════════════════════════════════════════════════
-- 1. Fix audit_log CHECK constraint — add 'delete' action
-- 2. Add search_path restriction to all SECURITY DEFINER functions
-- 3. Add upload concurrency advisory lock helper
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Fix audit_log CHECK constraint ────────────────────────────
-- The current constraint doesn't include 'delete', causing silent failures
-- when logging delete operations.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('upload', 'activate', 'delete', 'login', 'logout'));

-- ─── 2. Add search_path to SECURITY DEFINER functions ─────────────
-- Prevents search_path hijacking attacks.

-- 2a. filter_master_list (from 011)
CREATE OR REPLACE FUNCTION filter_master_list(
  p_search TEXT DEFAULT NULL,
  p_filters JSONB DEFAULT '{}',
  p_sort_column TEXT DEFAULT 'row_index',
  p_sort_direction TEXT DEFAULT 'asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  rows JSONB,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_upload_id UUID;
  where_clauses TEXT[] := ARRAY[]::TEXT[];
  where_sql TEXT := '';
  sort_sql TEXT;
  offset_val INT;
  final_sql TEXT;
  count_sql TEXT;
  result_rows JSONB;
  result_count BIGINT;
  search_mode TEXT := 'none';
  total_rows BIGINT := 0;
  vectorized_rows BIGINT := 0;
BEGIN
  -- Get the currently active upload
  SELECT id INTO active_upload_id
  FROM master_list_uploads
  WHERE is_active = true
  LIMIT 1;

  IF active_upload_id IS NULL THEN
    rows := '[]'::JSONB;
    total_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  where_clauses := array_append(where_clauses,
    format('r.upload_id = %L', active_upload_id));

  -- Determine search mode based on vectorization status
  IF p_search IS NOT NULL AND length(trim(p_search)) > 0 THEN
    SELECT count(*), count(*) FILTER (WHERE search_vector IS NOT NULL)
    INTO total_rows, vectorized_rows
    FROM master_list_rows
    WHERE upload_id = active_upload_id;

    IF total_rows > 0 AND vectorized_rows = total_rows THEN
      search_mode := 'fts';
    ELSIF vectorized_rows > 0 THEN
      search_mode := 'hybrid';
    ELSE
      search_mode := 'ilike';
    END IF;

    IF search_mode = 'fts' THEN
      where_clauses := array_append(where_clauses,
        format('r.search_vector @@ plainto_tsquery(''simple'', %L)', p_search));
    ELSIF search_mode = 'hybrid' THEN
      where_clauses := array_append(where_clauses,
        format('(r.search_vector @@ plainto_tsquery(''simple'', %L) OR '
               'EXISTS (SELECT 1 FROM jsonb_each_text(r.row_data) kv '
               'WHERE kv.value ILIKE ''%%'' || %L || ''%%''))',
               p_search, p_search));
    ELSE
      where_clauses := array_append(where_clauses,
        format('EXISTS (SELECT 1 FROM jsonb_each_text(r.row_data) kv '
               'WHERE kv.value ILIKE ''%%'' || %L || ''%%'')', p_search));
    END IF;
  END IF;

  -- JSON filters
  IF p_filters IS NOT NULL AND p_filters != '{}'::JSONB THEN
    DECLARE
      filter_key TEXT;
      filter_val TEXT;
    BEGIN
      FOR filter_key, filter_val IN
        SELECT key, value #>> '{}' FROM jsonb_each(p_filters)
      LOOP
        IF filter_val IS NOT NULL AND length(trim(filter_val)) > 0 THEN
          where_clauses := array_append(where_clauses,
            format('r.row_data ->> %L ILIKE ''%%'' || %L || ''%%''',
                   filter_key, filter_val));
        END IF;
      END LOOP;
    END;
  END IF;

  where_sql := array_to_string(where_clauses, ' AND ');

  -- Sorting
  IF p_sort_column = 'row_index' THEN
    sort_sql := format('r.row_index %s', CASE WHEN p_sort_direction = 'desc' THEN 'DESC' ELSE 'ASC' END);
  ELSE
    sort_sql := format('r.row_data ->> %L %s NULLS LAST',
                       p_sort_column,
                       CASE WHEN p_sort_direction = 'desc' THEN 'DESC' ELSE 'ASC' END);
  END IF;

  offset_val := (p_page - 1) * p_page_size;

  count_sql := format('SELECT count(*) FROM master_list_rows r WHERE %s', where_sql);
  EXECUTE count_sql INTO result_count;

  final_sql := format(
    'SELECT COALESCE(jsonb_agg(sub ORDER BY sub.rn), ''[]''::JSONB) FROM ('
    '  SELECT row_to_json(r.*)::JSONB AS sub, row_number() OVER () AS rn'
    '  FROM master_list_rows r'
    '  WHERE %s ORDER BY %s LIMIT %s OFFSET %s'
    ') t',
    where_sql, sort_sql, p_page_size, offset_val
  );
  EXECUTE final_sql INTO result_rows;

  rows := COALESCE(result_rows, '[]'::JSONB);
  total_count := COALESCE(result_count, 0);
  RETURN NEXT;
END;
$$;

-- 2b. generate_search_vectors_batch (from 008)
CREATE OR REPLACE FUNCTION generate_search_vectors_batch(
  p_upload_id UUID,
  p_batch_size INT DEFAULT 10000
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  WITH batch AS (
    SELECT id
    FROM master_list_rows
    WHERE upload_id = p_upload_id
      AND search_vector IS NULL
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE master_list_rows r
  SET search_vector = (
    SELECT to_tsvector('simple',
      string_agg(COALESCE(value, ''), ' ')
    )
    FROM jsonb_each_text(r.row_data)
  )
  FROM batch b
  WHERE r.id = b.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 2c. disable_search_trigger (from 008)
CREATE OR REPLACE FUNCTION disable_search_trigger()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
BEGIN
  ALTER TABLE master_list_rows DISABLE TRIGGER trg_rows_search_vector;
END;
$$;

-- 2d. enable_search_trigger (from 008)
CREATE OR REPLACE FUNCTION enable_search_trigger()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
BEGIN
  ALTER TABLE master_list_rows ENABLE TRIGGER trg_rows_search_vector;
END;
$$;

-- 2e. bulk_insert_master_list_rows (from 006, updated in 008)
CREATE OR REPLACE FUNCTION bulk_insert_master_list_rows(
  p_upload_id UUID,
  p_start_index INT,
  p_row_data_array JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INT;
BEGIN
  INSERT INTO master_list_rows (upload_id, row_index, row_data)
  SELECT
    p_upload_id,
    p_start_index + (ordinality - 1),
    value::JSONB
  FROM jsonb_array_elements(p_row_data_array) WITH ORDINALITY;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- 2f. format_array_column (from 006)
CREATE OR REPLACE FUNCTION format_array_column(val JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(val) = 'array' THEN
    RETURN (
      SELECT string_agg(elem #>> '{}', ', ')
      FROM jsonb_array_elements(val) AS elem
    );
  ELSE
    RETURN val #>> '{}';
  END IF;
END;
$$;

-- 2g. get_column_values (from 007)
CREATE OR REPLACE FUNCTION get_column_values(p_column_name TEXT)
RETURNS TABLE (value TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_upload_id UUID;
BEGIN
  SELECT id INTO active_upload_id
  FROM master_list_uploads
  WHERE is_active = true
  LIMIT 1;

  IF active_upload_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(format_array_column(r.row_data -> p_column_name), '') AS value,
    count(*)::BIGINT AS count
  FROM master_list_rows r
  WHERE r.upload_id = active_upload_id
    AND r.row_data ? p_column_name
  GROUP BY format_array_column(r.row_data -> p_column_name)
  ORDER BY count DESC
  LIMIT 100;
END;
$$;

-- 2h. update_search_vector_fn (from 009)
CREATE OR REPLACE FUNCTION update_search_vector_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := (
    SELECT to_tsvector('simple',
      string_agg(COALESCE(value, ''), ' ')
    )
    FROM jsonb_each_text(NEW.row_data)
  );
  RETURN NEW;
END;
$$;

-- ─── 3. Upload concurrency advisory lock helper ───────────────────
-- Uses a fixed advisory lock key for upload serialization.
-- pg_try_advisory_xact_lock is transaction-scoped (auto-releases).
CREATE OR REPLACE FUNCTION try_upload_lock()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lock key 1 = upload operations. Returns true if lock acquired.
  RETURN pg_try_advisory_xact_lock(1);
END;
$$;

CREATE OR REPLACE FUNCTION release_upload_lock()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Advisory xact locks release automatically on transaction end.
  -- This is a no-op helper for documentation clarity.
  PERFORM pg_advisory_unlock(1);
END;
$$;
