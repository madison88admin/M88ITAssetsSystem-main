-- =============================================
-- Migration 020: Fix v_lost_assets_full to include region_id
-- =============================================
-- Migration 019 accidentally omitted the region_id column when recreating
-- the view. This migration fixes that issue.

-- Drop and recreate the view with region_id included
DROP VIEW IF EXISTS v_lost_assets_full;

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
