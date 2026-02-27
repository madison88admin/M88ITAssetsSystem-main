-- ============================================
-- Migration 028: Add category_id to assignments view
-- ============================================
--
-- Adds category_id to v_asset_assignments_full so the
-- "lacking assets" feature can compare required categories
-- against assigned categories.
-- ============================================

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
    a.category_id,
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
