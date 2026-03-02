-- ============================================================
-- Migration 005: Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_list_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_list_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ─── Users ────────────────────────────────────────────

CREATE POLICY "users_read_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_read_all_da"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'da'
    )
  );

-- ─── Uploads ──────────────────────────────────────────

CREATE POLICY "uploads_read_all"
  ON public.master_list_uploads FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "uploads_insert_da"
  ON public.master_list_uploads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'da'
    )
  );

CREATE POLICY "uploads_update_da"
  ON public.master_list_uploads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'da'
    )
  );

-- ─── Rows ─────────────────────────────────────────────

CREATE POLICY "rows_read_all"
  ON public.master_list_rows FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "rows_insert_da"
  ON public.master_list_rows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'da'
    )
  );

CREATE POLICY "rows_delete_da"
  ON public.master_list_rows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'da'
    )
  );

-- ─── Audit Log ────────────────────────────────────────

CREATE POLICY "audit_read_da"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'da'
    )
  );

-- ─── Storage Bucket ───────────────────────────────────
-- NOTE: Run these in Supabase Dashboard SQL Editor after creating
-- the 'master-list-files' bucket manually.
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('master-list-files', 'master-list-files', FALSE);
--
-- CREATE POLICY "storage_upload_da"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'master-list-files'
--     AND EXISTS (
--       SELECT 1 FROM public.users u
--       WHERE u.id = auth.uid() AND u.role = 'da'
--     )
--   );
--
-- CREATE POLICY "storage_read_da"
--   ON storage.objects FOR SELECT
--   USING (
--     bucket_id = 'master-list-files'
--     AND EXISTS (
--       SELECT 1 FROM public.users u
--       WHERE u.id = auth.uid() AND u.role = 'da'
--     )
--   );
