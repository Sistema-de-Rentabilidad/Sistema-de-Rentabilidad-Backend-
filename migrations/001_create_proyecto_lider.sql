-- ============================================================
-- Migration 001: Many-to-many leaders per project
-- Run once against the database before deploying the new code
-- ============================================================

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS proyecto_lider (
  id_proyecto INTEGER NOT NULL REFERENCES proyecto(id_proyecto) ON DELETE CASCADE,
  id_lider    INTEGER NOT NULL REFERENCES usuario(id_usuario)   ON DELETE CASCADE,
  PRIMARY KEY (id_proyecto, id_lider)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_proyecto_lider_lider   ON proyecto_lider(id_lider);
CREATE INDEX IF NOT EXISTS idx_proyecto_lider_proyecto ON proyecto_lider(id_proyecto);

-- 3. Security: keep the table closed to Supabase Data API roles.
ALTER TABLE proyecto_lider ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_api_no_direct_access ON proyecto_lider;

CREATE POLICY data_api_no_direct_access
ON proyecto_lider
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

REVOKE ALL PRIVILEGES ON TABLE proyecto_lider FROM anon, authenticated, public;

-- 4. Migrate existing single-leader data into the new table
INSERT INTO proyecto_lider (id_proyecto, id_lider)
SELECT id_proyecto, id_lider
FROM proyecto
WHERE id_lider IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- The id_lider column in proyecto is kept as a convenience
-- field pointing to the primary (first) leader.
-- All leader lookups should use proyecto_lider as source of truth.
-- ============================================================
