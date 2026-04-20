-- Campos para sistema de fidelización
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS preferencia_contacto TEXT
    CHECK (preferencia_contacto IN ('whatsapp', 'llamada', 'email', 'visita')),
  ADD COLUMN IF NOT EXISTS acepta_marketing     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS referido_por_id      UUID REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_referido_por ON clientes(referido_por_id);
