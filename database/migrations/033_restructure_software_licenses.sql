-- Migration 033: Restructure Software Licenses
-- Add key_type column to software_licenses to distinguish between license key and email credentials
-- This supports the new workflow where licenses are created from employee/assignment forms

-- Add key_type column: 'license_key' or 'email'
ALTER TABLE software_licenses ADD COLUMN IF NOT EXISTS key_type TEXT DEFAULT 'license_key' CHECK (key_type IN ('license_key', 'email'));

-- Add a comment explaining the new workflow
COMMENT ON COLUMN software_licenses.key_type IS 'Type of credential stored in license_key column: license_key or email';
