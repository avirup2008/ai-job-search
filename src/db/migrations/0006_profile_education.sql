-- Migration: add education JSONB column to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]';
