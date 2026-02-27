-- =============================================
-- Migration 019: Make employee_id nullable in lost_assets
-- =============================================
-- Allows reporting lost assets that were not assigned to any employee
-- (e.g., assets that were in "available" status when lost)

-- Drop the view first (it references the column we're modifying)
DROP VIEW IF EXISTS v_lost_assets_full;

-- Make employee_id nullable
ALTER TABLE lost_assets 
ALTER COLUMN employee_id DROP NOT NULL;

-- Recreate the view to handle NULL employee_id
CREATE VIEW v_lost_assets_full AS
SELECT 
    la.*,
    COALESCE(e.full_name, 'Unassigned') as employee_name,
    e.email as employee_email,
    e.department,
    a.asset_tag,
    a.name as asset_name,
    a.serial_number,
    a.status as current_asset_status,
    c.name as category_name,
    u.email as reported_by_email,
    a.region_id
FROM lost_assets la
LEFT JOIN employees e ON la.employee_id = e.id
LEFT JOIN assets a ON la.asset_id = a.id
LEFT JOIN asset_categories c ON a.category_id = c.id
LEFT JOIN auth.users u ON la.reported_by = u.id
ORDER BY la.date_reported DESC;

-- Grant access to the view
GRANT SELECT ON v_lost_assets_full TO authenticated;
