-- ============================================
-- Migration 031: Fix foreign key constraints for user deletion
-- Madison 88 IT Equipment Inventory System
-- ============================================
--
-- Problem: Deleting a user from Supabase Auth fails because
-- foreign key constraints on user_profiles and other tables
-- reference auth.users(id) without ON DELETE CASCADE.
--
-- This migration:
-- 1. Fixes FK constraints to allow cascading deletes
-- 2. Creates a delete_user_and_profile() RPC function
--    that cleans up profile data so the auth user can be deleted
--
-- Run this migration in your Supabase SQL editor.
-- ============================================

-- ===========================================
-- 1. FIX user_profiles FK → auth.users
-- ===========================================
-- Drop the existing FK constraint on user_profiles.id → auth.users.id
-- and recreate it with ON DELETE CASCADE
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    -- Find the FK constraint name
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'user_profiles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE user_profiles DROP CONSTRAINT ' || fk_name;
        RAISE NOTICE 'Dropped FK constraint: %', fk_name;
    END IF;
END $$;

-- Recreate with CASCADE
ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ===========================================
-- 2. FIX system_settings.updated_by FK
-- ===========================================
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'system_settings'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'updated_by'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE system_settings DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ===========================================
-- 3. FIX audit_logs.logged_by FK
-- ===========================================
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'audit_logs'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'logged_by'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

-- Only add if the column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'logged_by'
    ) THEN
        EXECUTE 'ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
END $$;

-- ===========================================
-- 4. FIX employees.created_by FK
-- ===========================================
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'employees'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'created_by'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE employees DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'created_by'
    ) THEN
        EXECUTE 'ALTER TABLE employees ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
END $$;

-- ===========================================
-- 5. FIX lost_assets.reported_by FK
-- ===========================================
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'lost_assets'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'reported_by'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE lost_assets DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lost_assets' AND column_name = 'reported_by'
    ) THEN
        EXECUTE 'ALTER TABLE lost_assets ADD CONSTRAINT lost_assets_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
END $$;

-- ===========================================
-- 6. FIX user_roles.assigned_by FK
-- ===========================================
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'user_roles'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'assigned_by'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE user_roles DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ===========================================
-- 7. FIX user_regions.assigned_by FK
-- ===========================================
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'user_regions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'assigned_by'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE user_regions DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE user_regions
    ADD CONSTRAINT user_regions_assigned_by_fkey
    FOREIGN KEY (assigned_by) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ===========================================
-- 8. RPC FUNCTION: delete_user_profile
-- ===========================================
-- Deletes the user_profiles row and related data.
-- After this, the auth user can be deleted from the dashboard
-- or the cascading FK will handle it automatically.
CREATE OR REPLACE FUNCTION delete_user_profile(p_user_id UUID)
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
        RAISE EXCEPTION 'Only admin or executive users can delete profiles';
    END IF;

    -- Prevent deleting yourself
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;

    -- Delete from junction tables (these also cascade but being explicit)
    DELETE FROM user_roles WHERE user_id = p_user_id;
    DELETE FROM user_regions WHERE user_id = p_user_id;

    -- Nullify references in other tables
    UPDATE system_settings SET updated_by = NULL WHERE updated_by = p_user_id;
    UPDATE employees SET created_by = NULL WHERE created_by = p_user_id;

    -- Nullify audit_logs.logged_by if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'logged_by'
    ) THEN
        EXECUTE 'UPDATE audit_logs SET logged_by = NULL WHERE logged_by = $1' USING p_user_id;
    END IF;

    -- Nullify lost_assets.reported_by if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lost_assets' AND column_name = 'reported_by'
    ) THEN
        EXECUTE 'UPDATE lost_assets SET reported_by = NULL WHERE reported_by = $1' USING p_user_id;
    END IF;

    -- Delete the profile (auth.users row will remain — must be deleted from dashboard or via admin API)
    DELETE FROM user_profiles WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_profile TO authenticated;
