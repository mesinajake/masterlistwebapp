-- ============================================================
-- Migration 013: Create staging table for upload pipeline
--
-- Instead of dropping production indexes during COPY, we now
-- COPY into an unindexed staging table and atomically move
-- rows into the production table afterward.
-- ============================================================

-- Staging table — identical schema to master_list_rows but NO indexes
-- and NO triggers. Data is COPY'd here first, then moved.
CREATE TABLE IF NOT EXISTS public.master_list_rows_staging (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id     UUID NOT NULL,
  row_index     INTEGER NOT NULL,
  data          JSONB NOT NULL,
  search_vector TSVECTOR
);

-- No foreign key on staging (intentional — upload_id validated by app code)
-- No GIN index (intentional — we never search staging)
-- No triggers (intentional — vectors generated on production table)

COMMENT ON TABLE public.master_list_rows_staging IS
  'Temporary staging for bulk COPY during uploads. Rows are moved to master_list_rows after COPY completes.';
