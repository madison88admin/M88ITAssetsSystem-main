-- =============================================
-- Migration 021: Fix v_warranty_expiring to include region_id
-- =============================================
-- The v_warranty_expiring view was never updated in migration 016 to include
-- region_id, causing 400 Bad Request errors when the reports page tries to
-- filter by region_id.
--
-- This migration recreates the view with a.region_id included.
-- Run this in your Supabase SQL editor.
-- =============================================

DROP VIEW IF EXISTS v_warranty_expiring;

CREATE VIEW v_warranty_expiring AS
SELECT
    a.id,
    a.name,
    a.asset_tag,
    a.serial_number,
    a.brand,
    a.model,
    a.status,
    a.warranty_expiry,
    a.warranty_expiry AS warranty_end_date,
    (a.warranty_expiry - CURRENT_DATE) AS days_until_expiry,
    a.category_id,
    c.name AS category_name,
    a.department_id,
    d.name AS department_name,
    a.location_id,
    l.name AS location_name,
    a.region_id
FROM assets a
LEFT JOIN asset_categories c ON a.category_id = c.id
LEFT JOIN departments d ON a.department_id = d.id
LEFT JOIN locations l ON a.location_id = l.id
WHERE a.warranty_expiry IS NOT NULL
  AND a.warranty_expiry >= CURRENT_DATE
  AND a.warranty_expiry <= (CURRENT_DATE + INTERVAL '90 days');

GRANT SELECT ON v_warranty_expiring TO authenticated;
