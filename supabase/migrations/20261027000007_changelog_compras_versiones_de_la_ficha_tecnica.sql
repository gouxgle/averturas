-- Changelog: Compras: versiones de la ficha técnica
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Compras: versiones de la ficha técnica', 'Si el cliente cambia algo después de pedir cotización, el ítem se versiona (V1, V2…) sin tocar lo ya cotizado: cada cotización guarda una foto de la ficha que se envió, se ve qué cambió entre versiones y la orden de compra sale de la versión cotizada que se eligió.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20261027000007_changelog_compras_versiones_de_la_ficha_tecnica.sql') ON CONFLICT DO NOTHING;
