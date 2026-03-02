-- ============================================================
-- Migration 004: Create audit_log table
-- ============================================================

CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id),
  action      TEXT NOT NULL CHECK (action IN ('upload', 'activate', 'login', 'logout')),
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

CREATE INDEX idx_audit_log_user_id
  ON public.audit_log (user_id);
