-- ============================================
-- Migration 026: Create Software Categories Table
-- Madison 88 IT Equipment Inventory System
-- ============================================
--
-- Adds a `software_categories` table so admins/executives can
-- manage a list of software types (e.g., Productivity, Security,
-- Design, Communication, etc.) and assign them to software licenses.
--
-- Also adds a `category_id` FK column to `software_licenses`.
--
-- Run this migration in your Supabase SQL editor.
-- ============================================

-- ===========================================
-- 1. CREATE SOFTWARE_CATEGORIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS software_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_software_categories_name ON software_categories(name);
CREATE INDEX IF NOT EXISTS idx_software_categories_active ON software_categories(is_active);

-- Comment
COMMENT ON TABLE software_categories IS 'Lookup table for software license categories';
COMMENT ON COLUMN software_categories.is_active IS 'Indicates if the category is active and can be used for new licenses';

-- ===========================================
-- 2. ADD category_id TO software_licenses
-- ===========================================
ALTER TABLE software_licenses
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES software_categories(id);

CREATE INDEX IF NOT EXISTS idx_software_licenses_category ON software_licenses(category_id);

-- ===========================================
-- 3. SEED DEFAULT SOFTWARE CATEGORIES
-- ===========================================
INSERT INTO software_categories (name, description) VALUES
    ('Productivity', 'Office suites, word processors, spreadsheets'),
    ('Security', 'Antivirus, firewalls, endpoint protection'),
    ('Communication', 'Email clients, messaging, video conferencing'),
    ('Design', 'Graphics, CAD, video editing tools'),
    ('Development', 'IDEs, code editors, DevOps tools'),
    ('Database', 'Database management systems and tools'),
    ('Operating System', 'Desktop and server operating systems'),
    ('Utilities', 'System utilities, backup, compression'),
    ('Cloud Services', 'SaaS, PaaS, IaaS subscriptions'),
    ('Other', 'Uncategorized software')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- 4. ENABLE RLS (Row Level Security)
-- ===========================================
ALTER TABLE software_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "software_categories_select" ON software_categories
    FOR SELECT TO authenticated USING (true);

-- Only admins/executives can insert/update/delete
CREATE POLICY "software_categories_insert" ON software_categories
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'executive')
        )
    );

CREATE POLICY "software_categories_update" ON software_categories
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'executive')
        )
    );

CREATE POLICY "software_categories_delete" ON software_categories
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('admin', 'executive')
        )
    );
