-- Fotos de referencia del relevamiento in situ, para consultar al armar el presupuesto.
ALTER TABLE visitas_tecnicas ADD COLUMN IF NOT EXISTS imagenes TEXT[] NOT NULL DEFAULT '{}';

INSERT INTO schema_migrations (filename) VALUES ('20260722000003_visitas_tecnicas_imagenes.sql') ON CONFLICT DO NOTHING;
