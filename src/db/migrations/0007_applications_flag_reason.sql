-- Migration: add flag_reason column to applications table
-- Used to capture why a job was marked "not a fit" for dynamic scoring feedback.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS flag_reason text;
