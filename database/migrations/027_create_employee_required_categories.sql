-- ============================================
-- Migration 027: Employee Required Asset Categories
-- ============================================
--
-- Creates a junction table linking employees to the asset categories
-- they need in order to perform their job. This data is surfaced on
-- the Assignments page so admins / IT staff can quickly see which
-- assets an employee still lacks and prioritize accordingly.
-- ============================================

-- 1. CREATE JUNCTION TABLE
CREATE TABLE IF NOT EXISTS employee_required_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, category_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_emp_req_cat_employee ON employee_required_categories(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_req_cat_category ON employee_required_categories(category_id);

COMMENT ON TABLE employee_required_categories IS 'Maps employees to the asset categories they require for their role';

-- 2. ROW-LEVEL SECURITY
ALTER TABLE employee_required_categories ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "emp_req_cat_select" ON employee_required_categories
    FOR SELECT TO authenticated USING (true);

-- Admins / IT staff can insert
CREATE POLICY "emp_req_cat_insert" ON employee_required_categories
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'it_staff', 'executive')
        )
    );

-- Admins / IT staff can delete
CREATE POLICY "emp_req_cat_delete" ON employee_required_categories
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
              AND role IN ('admin', 'it_staff', 'executive')
        )
    );
