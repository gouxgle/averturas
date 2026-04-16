-- ============================================================
-- Migración: campos de documento en clientes
-- ============================================================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_persona TEXT NOT NULL DEFAULT 'fisica'
    CHECK (tipo_persona IN ('fisica', 'juridica')),
  ADD COLUMN IF NOT EXISTS documento_nro TEXT;

COMMENT ON COLUMN clientes.tipo_persona   IS 'fisica = persona física (DNI), juridica = empresa (CUIT)';
COMMENT ON COLUMN clientes.documento_nro  IS 'DNI para persona física, CUIT para empresa';
