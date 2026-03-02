-- ============================================================
-- Migration 003: Create master_list_rows table
-- ============================================================

CREATE TABLE public.master_list_rows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id     UUID NOT NULL REFERENCES public.master_list_uploads(id) ON DELETE CASCADE,
  row_index     INTEGER NOT NULL,
  data          JSONB NOT NULL,
  search_vector TSVECTOR
);

-- Full-text search index (GIN)
CREATE INDEX idx_rows_search_vector
  ON public.master_list_rows
  USING GIN (search_vector);

-- Index for fetching rows by upload (with ordering)
CREATE INDEX idx_rows_upload_id_row_index
  ON public.master_list_rows (upload_id, row_index);

-- Function: Auto-generate search_vector from all JSONB values
CREATE OR REPLACE FUNCTION generate_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  combined_text TEXT := '';
  val TEXT;
BEGIN
  FOR val IN SELECT value FROM jsonb_each_text(NEW.data)
  LOOP
    combined_text := combined_text || ' ' || COALESCE(val, '');
  END LOOP;
  NEW.search_vector := to_tsvector('simple', combined_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rows_search_vector
  BEFORE INSERT OR UPDATE ON public.master_list_rows
  FOR EACH ROW
  EXECUTE FUNCTION generate_search_vector();
