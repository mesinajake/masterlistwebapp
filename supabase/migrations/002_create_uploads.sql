-- ============================================================
-- Migration 002: Create master_list_uploads table
-- ============================================================

CREATE TABLE public.master_list_uploads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  row_count       INTEGER NOT NULL DEFAULT 0,
  column_headers  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active upload at a time (partial unique index)
CREATE UNIQUE INDEX idx_uploads_active
  ON public.master_list_uploads (is_active)
  WHERE is_active = TRUE;

-- Index for listing history by date
CREATE INDEX idx_uploads_created_at
  ON public.master_list_uploads (created_at DESC);

-- Index for uploaded_by lookup
CREATE INDEX idx_uploads_uploaded_by
  ON public.master_list_uploads (uploaded_by);
