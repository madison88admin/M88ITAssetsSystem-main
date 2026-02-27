-- =============================================
-- Migration 017: Add IT Staff Audit Logs Permission + Update RLS
-- Phase 3: Settings & Permissions Enforcement
-- =============================================

-- 1. Add IT Staff audit logs permission setting
INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
VALUES ('it_staff_can_access_audit_logs', 'true', 'boolean', 'Controls whether IT Staff can access the Audit Logs page')
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Update RLS policy on system_settings to allow executives to manage settings
-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Allow admin to update settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;
DROP POLICY IF EXISTS "Admin and Executive can manage settings" ON system_settings;

-- Create new policy allowing both admin and executive to manage settings
CREATE POLICY "Admin and Executive can manage settings" ON system_settings
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'executive')
    )
);

-- Ensure read access for all authenticated users (for permission checks)
DROP POLICY IF EXISTS "Authenticated users can read settings" ON system_settings;
DROP POLICY IF EXISTS "Allow authenticated to read settings" ON system_settings;

CREATE POLICY "Authenticated users can read settings" ON system_settings
FOR SELECT USING (auth.role() = 'authenticated');
