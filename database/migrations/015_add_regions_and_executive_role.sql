-- ============================================
-- Migration 015: Add Regions Table & Executive Role
-- Madison 88 IT Equipment Inventory System
-- ============================================
-- 
-- Phase 1 of the Role Restructure:
--   1. Create `regions` table for dynamic region management
--   2. Add `region_id` column to `user_profiles` (NULL = all regions, i.e. Executive)
--   3. Update role check constraint to include 'executive'
--   4. Seed the 4 initial regions
--
-- Run this migration in your Supabase SQL editor.
-- ============================================

-- ===========================================
-- 1. CREATE REGIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS regions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,          -- short code: PH, ID, CN, US
    country TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on regions
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- Everyone can read regions
CREATE POLICY "regions_select_all" ON regions
    FOR SELECT USING (true);

-- Only executives can insert/update/delete regions
CREATE POLICY "regions_insert_executive" ON regions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'executive'
        )
    );

CREATE POLICY "regions_update_executive" ON regions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'executive'
        )
    );

CREATE POLICY "regions_delete_executive" ON regions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'executive'
        )
    );

-- ===========================================
-- 2. SEED INITIAL REGIONS
-- ===========================================
INSERT INTO regions (name, code, country) VALUES
    ('Madison88 IT Assets in the Philippines', 'PH', 'Philippines'),
    ('Madison88 IT Assets in Indonesia', 'ID', 'Indonesia'),
    ('Madison88 IT Assets in China', 'CN', 'China'),
    ('Madison88 IT Assets in United States', 'US', 'United States')
ON CONFLICT (code) DO NOTHING;

-- ===========================================
-- 3. UPDATE USER_PROFILES ROLE CONSTRAINT
-- ===========================================
-- Drop the existing role check constraint (name may vary)
DO $$
BEGIN
    -- Try to drop known constraint names
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS check_role;
    ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS valid_role;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Add new constraint that includes 'executive'
ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('executive', 'admin', 'it_staff', 'viewer'));

-- ===========================================
-- 4. ADD REGION_ID TO USER_PROFILES
-- ===========================================
-- NULL region_id means "all regions" (Executive role)
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

-- ===========================================
-- 5. ADD SYSTEM SETTING FOR DEFAULT REGION
-- ===========================================
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('default_region', '', 'Default region for new users')
ON CONFLICT (setting_key) DO NOTHING;

-- ===========================================
-- 6. DONE
-- ===========================================
-- After running this migration:
--   - Assign existing admin users a region_id
--   - Create executive users with region_id = NULL
--   - Update your frontend config to include the new role
