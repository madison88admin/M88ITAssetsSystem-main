-- ============================================
-- Migration 034: Add Temporary Asset Replacement Support
-- ============================================
-- Adds columns to asset_assignments to track temporary replacements
-- when an assigned asset goes under repair, is reported lost, or is damaged.
--
-- assignment_type: 'permanent' (default) or 'temporary'
-- replaced_assignment_id: FK to the original assignment being temporarily replaced
-- ============================================

-- 1. Add assignment_type column
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'permanent'
CHECK (assignment_type IN ('permanent', 'temporary'));

-- 2. Add replaced_assignment_id column (links temp assignment to original)
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS replaced_assignment_id UUID REFERENCES asset_assignments(id) ON DELETE SET NULL;

-- 3. Update the v_asset_assignments_full view to include new columns
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
    aa.assignment_type,
    aa.replaced_assignment_id,
    a.asset_tag,
    a.name AS asset_name,
    a.serial_number,
    a.status AS asset_status,
    a.category_id,
    e.full_name AS employee_name,
    e.employee_id AS employee_code,
    d.name AS department_name,
    ac.name AS category_name,
    u.email AS assigned_by_email,
    a.region_id
FROM asset_assignments aa
LEFT JOIN assets a ON aa.asset_id = a.id
LEFT JOIN employees e ON aa.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN auth.users u ON aa.assigned_by = u.id;

-- 4. Create an index for faster lookups of temporary assignments
CREATE INDEX IF NOT EXISTS idx_asset_assignments_replaced
ON asset_assignments(replaced_assignment_id)
WHERE replaced_assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asset_assignments_type
ON asset_assignments(assignment_type)
WHERE assignment_type = 'temporary';
