-- Migration 029: Allow direct employee license assignments (without hardware)
-- This adds an employee_id column to license_assignments so that
-- software licenses can be assigned directly to employees without
-- requiring an intermediate hardware asset link.

-- 1. Add employee_id column (nullable FK to employees)
ALTER TABLE public.license_assignments
    ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id);

-- 2. Make asset_id nullable (was previously required)
ALTER TABLE public.license_assignments
    ALTER COLUMN asset_id DROP NOT NULL;

-- 3. Back-fill employee_id for existing asset-linked assignments
--    by looking up the current active asset_assignments
UPDATE public.license_assignments la
SET employee_id = aa.employee_id
FROM public.asset_assignments aa
WHERE la.asset_id = aa.asset_id
  AND aa.returned_date IS NULL
  AND la.employee_id IS NULL;

-- 4. Add index for efficient employee-based lookups
CREATE INDEX IF NOT EXISTS idx_license_assignments_employee_id
    ON public.license_assignments (employee_id);

-- 5. Add check constraint: at least one of asset_id or employee_id must be set
ALTER TABLE public.license_assignments
    ADD CONSTRAINT chk_license_assignment_target
    CHECK (asset_id IS NOT NULL OR employee_id IS NOT NULL);
