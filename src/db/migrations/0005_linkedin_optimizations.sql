-- Migration: linkedin_optimizations table for LinkedIn Profile Optimizer
CREATE TABLE IF NOT EXISTS linkedin_optimizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  raw_text   text NOT NULL,
  rewrites   jsonb NOT NULL,
  token_cost numeric(10,6),
  model      text
);
