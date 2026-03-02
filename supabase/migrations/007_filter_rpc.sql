-- ============================================================
-- Migration 007: Filtered query RPC function
-- ============================================================
-- Handles column filtering, full-text search, and pagination
-- with a 60s statement timeout (bypasses default 8s REST API limit).
-- Supports both array-format and object-format JSONB data.

CREATE OR REPLACE FUNCTION filter_master_list(
  p_upload_id UUID,
  p_filters JSONB DEFAULT '{}'::jsonb,
  p_column_headers TEXT[] DEFAULT '{}'::text[],
  p_search TEXT DEFAULT '',
  p_page_size INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '60s'
AS $$
DECLARE
  v_total BIGINT;
  v_rows JSONB;
  v_filter_key TEXT;
  v_filter_value TEXT;
  v_col_index INTEGER;
  v_conditions TEXT[] := ARRAY[]::text[];
  v_where TEXT;
  v_is_array BOOLEAN;
  v_has_vectors BOOLEAN;
  v_search_parts TEXT[] := ARRAY[]::text[];
  v_combined_search TEXT;
BEGIN
  v_is_array := (p_column_headers IS NOT NULL
                 AND array_length(p_column_headers, 1) IS NOT NULL
                 AND array_length(p_column_headers, 1) > 0);

  -- ── Build column filter conditions ──────────────────────────
  FOR v_filter_key, v_filter_value IN
    SELECT key, value #>> '{}' FROM jsonb_each(p_filters)
  LOOP
    IF v_filter_value IS NOT NULL AND v_filter_value != '' THEN
      -- Collect filter values for textSearch pre-filter
      v_search_parts := array_append(v_search_parts, v_filter_value);

      IF v_is_array THEN
        -- Array format: find 0-based index of the column name
        v_col_index := NULL;
        FOR i IN 1..array_length(p_column_headers, 1) LOOP
          IF p_column_headers[i] = v_filter_key THEN
            v_col_index := i - 1;
            EXIT;
          END IF;
        END LOOP;

        IF v_col_index IS NOT NULL THEN
          v_conditions := array_append(v_conditions,
            format('data->>%s ILIKE %L', v_col_index, '%%' || v_filter_value || '%%')
          );
        END IF;
      ELSE
        -- Object format: use key name directly
        v_conditions := array_append(v_conditions,
          format('data->>%L ILIKE %L', v_filter_key, '%%' || v_filter_value || '%%')
        );
      END IF;
    END IF;
  END LOOP;

  -- ── Full-text search from search bar ────────────────────────
  IF p_search IS NOT NULL AND p_search != '' THEN
    v_search_parts := array_append(v_search_parts, p_search);
  END IF;

  -- ── TextSearch pre-filter (uses GIN index for speed) ────────
  -- Only use if search_vectors are populated for this upload.
  v_combined_search := array_to_string(v_search_parts, ' ');
  IF v_combined_search != '' THEN
    EXECUTE format(
      'SELECT EXISTS(SELECT 1 FROM master_list_rows WHERE upload_id = %L AND search_vector IS NOT NULL LIMIT 1)',
      p_upload_id
    ) INTO v_has_vectors;

    IF v_has_vectors THEN
      v_conditions := array_append(v_conditions,
        format('search_vector @@ plainto_tsquery(''simple'', %L)', v_combined_search)
      );
    END IF;
  END IF;

  -- ── Assemble WHERE clause ───────────────────────────────────
  v_where := format('upload_id = %L', p_upload_id);
  IF array_length(v_conditions, 1) IS NOT NULL AND array_length(v_conditions, 1) > 0 THEN
    v_where := v_where || ' AND ' || array_to_string(v_conditions, ' AND ');
  END IF;

  -- ── Count total matching rows ───────────────────────────────
  EXECUTE 'SELECT count(*) FROM master_list_rows WHERE ' || v_where
  INTO v_total;

  -- ── Fetch paginated rows ────────────────────────────────────
  EXECUTE
    'SELECT COALESCE(jsonb_agg(row_to_json(sub)::jsonb), ''[]''::jsonb) FROM ('
    || 'SELECT id, row_index, data FROM master_list_rows WHERE ' || v_where
    || ' ORDER BY row_index LIMIT ' || p_page_size || ' OFFSET ' || p_offset
    || ') sub'
  INTO v_rows;

  RETURN jsonb_build_object(
    'total', v_total,
    'rows',  COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- Delete upload rows RPC function
-- ============================================================
-- Deletes all rows for an upload with a longer statement timeout.
-- Needed because 339K+ rows exceed the default 8s REST API timeout.

CREATE OR REPLACE FUNCTION delete_upload_rows(p_upload_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete all rows for this upload
  DELETE FROM master_list_rows WHERE upload_id = p_upload_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Delete the upload record itself (within the same extended-timeout transaction)
  DELETE FROM master_list_uploads WHERE id = p_upload_id;

  RETURN deleted_count;
END;
$$;
