-- ============================================
-- Migration 030: Fix user_profiles INSERT RLS Policy
-- Madison 88 IT Equipment Inventory System
-- ============================================
--
-- Adds INSERT / UPDATE policies on `user_profiles` so that
-- admin and executive users can create and manage profiles
-- for newly invited users.
--
-- Also creates a SECURITY DEFINER function `create_user_profile`
-- as a reliable alternative that bypasses RLS entirely.
--
-- Run this migration in your Supabase SQL editor.
-- ============================================

-- ===========================================
-- 1. ADD INSERT POLICY ON user_profiles
-- ===========================================
-- Drop existing insert policy if it exists (safe to re-run)
DROP POLICY IF EXISTS "user_profiles_insert_admin" ON user_profiles;

-- Allow admin/executive to insert new user profiles
CREATE POLICY "user_profiles_insert_admin" ON user_profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- ===========================================
-- 2. ENSURE UPDATE POLICY EXISTS
-- ===========================================
DROP POLICY IF EXISTS "user_profiles_update_admin" ON user_profiles;

-- Allow admin/executive to update any user profile
CREATE POLICY "user_profiles_update_admin" ON user_profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- ===========================================
-- 3. SECURITY DEFINER FUNCTION (bypasses RLS)
-- ===========================================
-- This function can be called via supabase.rpc('create_user_profile', {...})
-- and will always succeed regardless of RLS policies.

CREATE OR REPLACE FUNCTION create_user_profile(
    p_user_id UUID,
    p_email TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_region_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the caller is an admin or executive
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() AND role IN ('executive', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only admin or executive users can create profiles';
    END IF;

    INSERT INTO user_profiles (id, email, full_name, role, region_id, is_active)
    VALUES (p_user_id, p_email, p_full_name, p_role, p_region_id, p_is_active)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        region_id = EXCLUDED.region_id,
        is_active = EXCLUDED.is_active;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
