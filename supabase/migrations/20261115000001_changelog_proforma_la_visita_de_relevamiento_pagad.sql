-- Changelog: Proforma: la visita de relevamiento pagada se ve descontada
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Proforma: la visita de relevamiento pagada se ve descontada', 'En la proforma, la visita de relevamiento ya pagada aparece como un renglón descontado debajo del total, con el importe que queda a pagar.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261115000001_changelog_proforma_la_visita_de_relevamiento_pagad.sql') ON CONFLICT DO NOTHING;
