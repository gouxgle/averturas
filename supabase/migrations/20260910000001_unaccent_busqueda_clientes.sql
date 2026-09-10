-- Habilita `unaccent` para que la búsqueda de clientes ignore los acentos:
-- buscar "podologa" tiene que encontrar a "Podóloga", y "nuñez" a "Núñez".
-- ILIKE es sensible a los acentos, así que sin esto el operador tiene que
-- escribirlos exactamente como se cargaron — y no siempre se cargan igual.
--
-- Se usa solo en el WHERE, no en un índice: la búsqueda ya es ILIKE '%...%',
-- que tampoco usa índice, así que no cambia el plan de ejecución.
CREATE EXTENSION IF NOT EXISTS unaccent;

INSERT INTO schema_migrations (filename) VALUES ('20260910000001_unaccent_busqueda_clientes.sql') ON CONFLICT DO NOTHING;
