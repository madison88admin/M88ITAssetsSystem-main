-- ============================================
-- Migration 025: Create User Roles & User Regions Junction Tables
-- Madison 88 IT Equipment Inventory System
-- ============================================
--
-- Adds support for users having MULTIPLE roles and MULTIPLE region assignments.
--
-- 1. `user_roles` — links a user to one or more roles (executive, admin, it_staff, viewer)
-- 2. `user_regions` — links a user to one or more regions
--
-- The existing `role` and `region_id` columns on `user_profiles` are kept
-- for backward compatibility but the new junction tables are the source of truth
-- for the User Maintenance page.
--
-- Run this migration in your Supabase SQL editor.
-- ============================================

-- ===========================================
-- 1. CREATE USER_ROLES JUNCTION TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('executive', 'admin', 'it_staff', 'viewer')),
    assigned_by UUID REFERENCES user_profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read user_roles
CREATE POLICY "user_roles_select_all" ON user_roles
    FOR SELECT USING (true);

-- Only admin/executive can insert
CREATE POLICY "user_roles_insert" ON user_roles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- Only admin/executive can update
CREATE POLICY "user_roles_update" ON user_roles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- Only admin/executive can delete
CREATE POLICY "user_roles_delete" ON user_roles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- ===========================================
-- 2. CREATE USER_REGIONS JUNCTION TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS user_regions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES user_profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, region_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_regions_user_id ON user_regions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_regions_region_id ON user_regions(region_id);

-- Enable RLS
ALTER TABLE user_regions ENABLE ROW LEVEL SECURITY;

-- Everyone can read user_regions
CREATE POLICY "user_regions_select_all" ON user_regions
    FOR SELECT USING (true);

-- Only admin/executive can insert
CREATE POLICY "user_regions_insert" ON user_regions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- Only admin/executive can update
CREATE POLICY "user_regions_update" ON user_regions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- Only admin/executive can delete
CREATE POLICY "user_regions_delete" ON user_regions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('executive', 'admin')
        )
    );

-- ===========================================
-- 3. SEED JUNCTION TABLES FROM EXISTING DATA
-- ===========================================
-- Migrate existing single role from user_profiles into user_roles
INSERT INTO user_roles (user_id, role)
SELECT id, role FROM user_profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Migrate existing single region_id from user_profiles into user_regions
INSERT INTO user_regions (user_id, region_id)
SELECT id, region_id FROM user_profiles
WHERE region_id IS NOT NULL
ON CONFLICT (user_id, region_id) DO NOTHING;
