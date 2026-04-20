-- Agrega teléfono fijo (línea domiciliaria, opcional)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS telefono_fijo TEXT;
