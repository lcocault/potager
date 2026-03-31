-- ============================================================
-- Migration: Undated itineraries (crop_paths dates → MM-DD)
-- ============================================================
-- Itinerary dates are now year-agnostic (MM-DD only).
-- A start_date is added to crop_instances so that actual
-- cultivation dates are computed from the chosen start date
-- and the itinerary offsets.
-- ============================================================

-- 1. Convert crop_paths date columns from DATE to VARCHAR(5) MM-DD
ALTER TABLE crop_paths
    ALTER COLUMN sowing_date     TYPE VARCHAR(5) USING TO_CHAR(sowing_date,     'MM-DD'),
    ALTER COLUMN transplant_date TYPE VARCHAR(5) USING TO_CHAR(transplant_date, 'MM-DD'),
    ALTER COLUMN planting_date   TYPE VARCHAR(5) USING TO_CHAR(planting_date,   'MM-DD'),
    ALTER COLUMN harvest_date    TYPE VARCHAR(5) USING TO_CHAR(harvest_date,    'MM-DD');

-- 2. Remove DATE-based indexes that no longer apply
DROP INDEX IF EXISTS idx_crop_paths_sowing;
DROP INDEX IF EXISTS idx_crop_paths_harvest;

-- 3. Add start_date to crop_instances
ALTER TABLE crop_instances
    ADD COLUMN IF NOT EXISTS start_date DATE;
