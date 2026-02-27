-- ============================================
-- Migration 016: Add Region Scoping to Data Tables
-- Madison 88 IT Equipment Inventory System
-- ============================================
--
-- Phase 2 of the Role Restructure:
--   1. Add region_id FK to assets, employees, software_licenses
--   2. Update all views to include region_id for frontend filtering
--   3. Add indexes for performance
--
-- Run this migration in your Supabase SQL editor AFTER migration 015.
-- ============================================

-- ===========================================
-- 1. ADD REGION_ID TO DATA TABLES
-- ===========================================

-- Assets table
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

CREATE INDEX IF NOT EXISTS idx_assets_region_id ON assets(region_id);

-- Employees table
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

CREATE INDEX IF NOT EXISTS idx_employees_region_id ON employees(region_id);

-- Software Licenses table
ALTER TABLE software_licenses
    ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

CREATE INDEX IF NOT EXISTS idx_software_licenses_region_id ON software_licenses(region_id);

-- ===========================================
-- 2. RECREATE VIEWS WITH REGION_ID
-- ===========================================

-- v_assets_full: include a.region_id and region name
DROP VIEW IF EXISTS v_assets_full;
CREATE VIEW v_assets_full AS
SELECT
    a.id,
    a.name,
    a.asset_tag,
    a.serial_number,
    a.brand,
    a.model,
    a.status,
    a.purchase_date,
    a.purchase_cost,
    a.warranty_expiry,
    a.refresh_date,
    a.specifications,
    a.notes,
    a.created_at,
    a.updated_at,
    a.category_id,
    c.name AS category_name,
    a.location_id,
    l.name AS location_name,
    a.department_id,
    d.name AS department_name,
    aa.employee_id,
    e.full_name AS assigned_to_name,
    aa.assigned_date,
    aa.returned_date,
    a.logged_by,
    up.email AS logged_by_email,
    a.region_id,
    r.name AS region_name,
    r.code AS region_code
FROM assets a
LEFT JOIN asset_categories c ON a.category_id = c.id
LEFT JOIN locations l ON a.location_id = l.id
LEFT JOIN departments d ON a.department_id = d.id
LEFT JOIN asset_assignments aa ON a.id = aa.asset_id AND aa.returned_date IS NULL
LEFT JOIN employees e ON aa.employee_id = e.id
LEFT JOIN user_profiles up ON a.logged_by = up.id
LEFT JOIN regions r ON a.region_id = r.id;

GRANT SELECT ON v_assets_full TO authenticated;

-- v_asset_assignments_full: include a.region_id
DROP VIEW IF EXISTS v_asset_assignments_full;
CREATE VIEW v_asset_assignments_full AS
SELECT
    aa.id,
    aa.asset_id,
    aa.employee_id,
    aa.assigned_date,
    aa.assigned_by,
    aa.returned_date,
    aa.notes,
    aa.created_at,
    a.asset_tag,
    a.name AS asset_name,
    a.serial_number,
    e.full_name AS employee_name,
    e.employee_id AS employee_code,
    d.name AS department_name,
    c.name AS category_name,
    u.email AS assigned_by_email,
    a.region_id
FROM asset_assignments aa
LEFT JOIN assets a ON aa.asset_id = a.id
LEFT JOIN employees e ON aa.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN asset_categories c ON a.category_id = c.id
LEFT JOIN auth.users u ON aa.assigned_by = u.id;

GRANT SELECT ON v_asset_assignments_full TO authenticated;

-- v_maintenance_records_full: include a.region_id
DROP VIEW IF EXISTS v_maintenance_records_full;
CREATE VIEW v_maintenance_records_full AS
SELECT
    mr.*,
    a.asset_tag,
    a.name AS asset_name,
    up.email AS created_by_email,
    a.region_id
FROM maintenance_records mr
LEFT JOIN assets a ON mr.asset_id = a.id
LEFT JOIN user_profiles up ON mr.created_by = up.id;

GRANT SELECT ON v_maintenance_records_full TO authenticated;

-- v_lost_assets_full: include a.region_id
DROP VIEW IF EXISTS v_lost_assets_full;
CREATE VIEW v_lost_assets_full AS
SELECT
    la.*,
    e.full_name AS employee_name,
    e.email AS employee_email,
    e.department,
    a.asset_tag,
    a.name AS asset_name,
    a.serial_number,
    a.status AS current_asset_status,
    c.name AS category_name,
    u.email AS reported_by_email,
    a.region_id
FROM lost_assets la
LEFT JOIN employees e ON la.employee_id = e.id
LEFT JOIN assets a ON la.asset_id = a.id
LEFT JOIN asset_categories c ON a.category_id = c.id
LEFT JOIN auth.users u ON la.reported_by = u.id
ORDER BY la.date_reported DESC;

GRANT SELECT ON v_lost_assets_full TO authenticated;

-- v_employees_full: include e.region_id and region name
DROP VIEW IF EXISTS v_employees_full;
CREATE VIEW v_employees_full AS
SELECT
    e.*,
    d.name AS department_name,
    l.name AS location_name,
    up.email AS created_by_email,
    r.name AS region_name,
    r.code AS region_code
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN locations l ON e.location_id = l.id
LEFT JOIN user_profiles up ON e.created_by = up.id
LEFT JOIN regions r ON e.region_id = r.id;

GRANT SELECT ON v_employees_full TO authenticated;

-- ===========================================
-- 3. DONE
-- ===========================================
-- After running this migration:
--   - Existing data will have region_id = NULL
--   - Run an UPDATE to assign region_id to existing assets/employees/licenses
--     based on your needs, e.g.:
--       UPDATE assets SET region_id = '<your-PH-region-uuid>' WHERE region_id IS NULL;
--       UPDATE employees SET region_id = '<your-PH-region-uuid>' WHERE region_id IS NULL;
--       UPDATE software_licenses SET region_id = '<your-PH-region-uuid>' WHERE region_id IS NULL;
