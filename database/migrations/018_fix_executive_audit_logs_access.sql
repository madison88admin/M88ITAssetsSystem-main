-- =============================================
-- Migration 018: Fix Executive Audit Logs Access
-- =============================================
-- The executive role must see ALL audit logs from every user
-- regardless of region or role. Currently, RLS only grants
-- full SELECT access to admins. This adds the same for executives.

-- Drop existing executive policy if it exists (idempotent)
DROP POLICY IF EXISTS "Executives can view all audit logs" ON public.audit_logs;

-- Allow executives to view ALL audit logs across all regions and roles
CREATE POLICY "Executives can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'executive'
  )
);
