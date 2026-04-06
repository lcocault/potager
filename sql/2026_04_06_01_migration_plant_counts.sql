-- ============================================================
-- Migration: Plant count fields on crop_instances
-- ============================================================
-- Adds four integer columns to record the number of plants
-- sown, transplanted, planted in the ground, and harvested.
-- ============================================================

ALTER TABLE crop_instances
    ADD COLUMN IF NOT EXISTS nb_sowed        INTEGER,
    ADD COLUMN IF NOT EXISTS nb_transplanted INTEGER,
    ADD COLUMN IF NOT EXISTS nb_planted      INTEGER,
    ADD COLUMN IF NOT EXISTS nb_harvested    INTEGER;
