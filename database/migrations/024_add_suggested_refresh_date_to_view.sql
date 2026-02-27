-- =============================================
-- Migration 024: Add suggested_refresh_date to v_assets_refresh_due
-- =============================================
-- Adds a computed column: COALESCE(explicit refresh_date, purchase_date + 5 years)
-- Also adds a boolean is_refresh_date_estimated so the UI can label it "(est.)"
-- Run this in your Supabase SQL editor.
-- =============================================

DROP VIEW IF EXISTS v_assets_refresh_due;

CREATE VIEW v_assets_refresh_due AS
SELECT
    a.id,
    a.name,
    a.asset_tag,
    a.serial_number,
    a.brand,
    a.model,
    a.status,
    a.purchase_date,
    a.refresh_date,
    -- Suggested refresh: use explicit date if set, otherwise purchase_date + 5 years
    COALESCE(
        a.refresh_date,
        CASE WHEN a.purchase_date IS NOT NULL
             THEN (a.purchase_date::DATE + INTERVAL '5 years')::DATE
             ELSE NULL
        END
    ) AS suggested_refresh_date,
    -- True when refresh_date is not explicitly set (so UI can show "est." label)
    (a.refresh_date IS NULL) AS is_refresh_date_estimated,
    FLOOR((CURRENT_DATE - a.purchase_date::DATE) / 365.25) AS age_years,
    a.category_id,
    c.name  AS category_name,
    a.department_id,
    d.name  AS department_name,
    a.region_id
FROM assets a
LEFT JOIN asset_categories c ON a.category_id = c.id
LEFT JOIN departments      d ON a.department_id = d.id
WHERE a.status NOT IN ('decommissioned', 'lost', 'damaged')
  AND (
        -- Explicit refresh date has passed
        (a.refresh_date IS NOT NULL AND a.refresh_date <= CURRENT_DATE)
        OR
        -- No refresh date but purchase date is 5+ years ago
        (a.purchase_date IS NOT NULL AND a.purchase_date <= (CURRENT_DATE - INTERVAL '5 years'))
      );

GRANT SELECT ON v_assets_refresh_due TO authenticated;
