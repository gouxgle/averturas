-- Agrega campo genero a clientes (solo aplica a personas físicas)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS genero TEXT CHECK (genero IN ('masculino', 'femenino', 'otro'));

COMMENT ON COLUMN clientes.genero IS 'Solo para personas físicas';
