-- Migration 032: Add is_active column to software_licenses
-- This allows licenses to be deactivated instead of deleted.

ALTER TABLE software_licenses
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_software_licenses_is_active ON software_licenses(is_active);
