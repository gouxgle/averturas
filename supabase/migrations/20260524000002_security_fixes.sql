-- Fixes de seguridad: token de acceso con expiración + índices FK faltantes

-- Expiración opcional para tokens de acceso público (NULL = no expira)
ALTER TABLE operaciones
  ADD COLUMN IF NOT EXISTS token_expira_at TIMESTAMPTZ DEFAULT NULL;

-- Índices FK faltantes que causaban seq scans en operaciones
CREATE INDEX IF NOT EXISTS idx_operaciones_proveedor_id  ON operaciones(proveedor_id)  WHERE proveedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operaciones_created_by    ON operaciones(created_by)    WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_remitos_cliente_id        ON remitos(cliente_id);

INSERT INTO schema_migrations (filename) VALUES ('20260524000002_security_fixes.sql') ON CONFLICT DO NOTHING;
