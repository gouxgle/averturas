-- ============================================================
-- Seed: datos de referencia iniciales
-- El usuario admin se crea desde apply-migrations.sh
-- ============================================================

INSERT INTO tipos_abertura (nombre, orden) VALUES
  ('Ventana',        1),
  ('Puerta',         2),
  ('Puerta-ventana', 3),
  ('Celosía',        4),
  ('Reja',           5),
  ('Cortina',        6),
  ('Mosquitero',     7);

INSERT INTO sistemas (nombre, material) VALUES
  ('DVH',           'vidrio'),
  ('Simple',        'vidrio'),
  ('Línea 25',      'aluminio'),
  ('Línea 30',      'aluminio'),
  ('Línea Herrero', 'aluminio'),
  ('PVC Estándar',  'PVC'),
  ('PVC Premium',   'PVC');

INSERT INTO colores (nombre, hex) VALUES
  ('Natural',   '#c0c0c0'),
  ('Blanco',    '#ffffff'),
  ('Negro',     '#222222'),
  ('Bronce',    '#8b5e3c'),
  ('Champagne', '#f7e7ce'),
  ('Nogal',     '#5c3d1e');

INSERT INTO categorias_cliente (nombre, color, orden) VALUES
  ('Particular',   '#6366f1', 1),
  ('Constructor',  '#f59e0b', 2),
  ('Inmobiliaria', '#10b981', 3),
  ('Arquitecto',   '#8b5cf6', 4),
  ('Mayorista',    '#ef4444', 5);
