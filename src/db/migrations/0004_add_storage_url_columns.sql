-- Migration: add typed storage columns to documents table
-- blobUrlDocx is kept for backward compat and will be removed in a future migration.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS render_kind text;

-- Backfill: copy blobUrlDocx → storage_url for all existing rows
UPDATE documents SET storage_url = blob_url_docx WHERE storage_url IS NULL AND blob_url_docx IS NOT NULL;

-- Infer format/mimeType/renderKind from kind column
UPDATE documents SET
  format = CASE kind
    WHEN 'cv' THEN 'docx'
    WHEN 'cover' THEN 'markdown'
    WHEN 'screening' THEN 'markdown'
    WHEN 'interview-prep' THEN 'markdown'
    WHEN 'artifact' THEN 'html'
    ELSE 'docx'
  END,
  mime_type = CASE kind
    WHEN 'cv' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    WHEN 'cover' THEN 'text/markdown'
    WHEN 'screening' THEN 'text/markdown'
    WHEN 'interview-prep' THEN 'text/markdown'
    WHEN 'artifact' THEN 'text/html'
    ELSE 'application/octet-stream'
  END,
  render_kind = CASE kind
    WHEN 'cv' THEN 'download'
    WHEN 'cover' THEN 'copy'
    WHEN 'screening' THEN 'copy'
    WHEN 'interview-prep' THEN 'copy'
    WHEN 'artifact' THEN 'viewer'
    ELSE 'download'
  END
WHERE format IS NULL;
