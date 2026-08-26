-- Firma digital del cliente en la Visita de Relevamiento de Datos (conformidad
-- con las medidas relevadas). Se sube como imagen (PNG del canvas) al mismo
-- endpoint que las fotos de la visita.

ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS firma_url TEXT;

INSERT INTO schema_migrations (filename)
VALUES ('20260825000002_visitas_tecnicas_firma.sql') ON CONFLICT DO NOTHING;
