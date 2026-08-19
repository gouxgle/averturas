-- Historial diario de la cotización del dólar, para poder mostrar la evolución
-- de los últimos días (mismo patrón visual que el pronóstico extendido del clima).
-- No hay cron: se va sembrando solo con el primer pedido de cotización de cada día
-- (GET /catalogo/cotizacion-dolar), igual que el resto de los mecanismos "sin cron"
-- de este proyecto (oportunidades futuras, entregas programadas).

CREATE TABLE IF NOT EXISTS cotizacion_dolar_historial (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha      DATE NOT NULL UNIQUE,
  compra     NUMERIC(10,2) NOT NULL,
  venta      NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (filename)
VALUES ('20260816000008_cotizacion_dolar_historial.sql') ON CONFLICT DO NOTHING;
