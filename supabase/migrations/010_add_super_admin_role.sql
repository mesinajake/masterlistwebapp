-- Migration 010: Add super_admin role
-- Update the CHECK constraint on users.role to include 'super_admin'.
-- Then promote the first DA user to super_admin (if no super_admin exists yet).

-- 1. Update the CHECK constraint to allow 'super_admin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'da', 'agent'));

-- 2. If there are zero users, the first login will auto-assign super_admin.
--    If there is already a DA user, promote the first one to super_admin.
UPDATE users
SET role = 'super_admin', updated_at = NOW()
WHERE id = (
  SELECT id FROM users WHERE role = 'da' ORDER BY created_at ASC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'super_admin');
