-- Registro cronológico de cambios del sistema, visible dentro de la app, para
-- que el equipo pueda ver qué se modificó y cuándo, y así probar cada cambio
-- siguiendo un control ordenado.
CREATE TABLE changelog_cambios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  titulo      TEXT NOT NULL,
  descripcion TEXT,
  categoria   TEXT NOT NULL DEFAULT 'mejora' CHECK (categoria IN ('feature','fix','mejora')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_changelog_fecha ON changelog_cambios(fecha DESC);

-- Historial reciente (sesiones previas + esta), para arrancar con contexto útil.
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  ('2026-07-25', 'Catálogo de servicios, filtros de galería y árbol de categorías/modelos', NULL, 'feature'),
  ('2026-07-25', 'Visitas técnicas: relevar productos de catálogo (estándar)', NULL, 'feature'),
  ('2026-07-25', 'Visitas técnicas: corrige overflow de medidas y agrega pegar/arrastrar fotos', NULL, 'fix'),
  ('2026-07-25', 'Email de proforma, atributos por tipo de abertura y mejoras varias', NULL, 'feature'),
  ('2026-07-26', 'Presupuestos: reutiliza el token de link público al compartir por varios canales', NULL, 'fix'),
  ('2026-07-26', 'Visitas técnicas: el formulario de impresión entra en una sola hoja A4', NULL, 'fix'),
  ('2026-07-27', 'Visitas técnicas: corrige 5 defectos y agrega carga de specs de abertura al relevar',
    'Ahora se puede cargar tipo de abertura, sistema, color, vidrio, premarco, accesorios y foto usando el mismo editor del presupuesto.', 'fix'),
  ('2026-07-28', 'Presupuestos: varias formas de pago alternativas',
    'Se puede ofrecer Contado con descuento, cuotas, etc. El cliente las ve comparadas en el link público y el vendedor elige cuál se usó al cobrar.', 'feature'),
  ('2026-07-28', 'Productos: anchos de hoja 60 a 100cm disponibles en puertas', NULL, 'mejora'),
  ('2026-07-28', 'Dashboard: indicador de Valor Dólar', 'Mismo valor que usa Productos para calcular el precio en U$S.', 'feature'),
  ('2026-07-28', 'Presupuestos: el email al cliente usa el mismo mensaje que WhatsApp', NULL, 'mejora'),
  ('2026-07-28', 'Nuevo Producto: mayor contraste de texto en todo el formulario', 'Los grises se reemplazaron por negro para mejorar la legibilidad.', 'mejora'),
  ('2026-07-28', 'Productos: el precio se colorea según antigüedad de actualización',
    'Verde si se actualizó hace 7 días o menos, amarillo entre 8 y 10, rojo pasado ese plazo.', 'feature'),
  ('2026-07-28', 'CRM: agenda de contactos con atrasados, hoy y próximos 3 días',
    'Permite marcar cada contacto como resuelto directamente desde el tablero.', 'feature'),
  ('2026-07-28', 'Buzón de comentarios flotante compartido por el equipo',
    'Disponible en cualquier pantalla, para anotar pendientes y marcarlos como resueltos.', 'feature'),
  ('2026-07-28', 'Registro de cambios del sistema (este mismo)', 'Para llevar control y facilitar las pruebas de cada cambio.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260728000004_changelog.sql')
  ON CONFLICT DO NOTHING;
