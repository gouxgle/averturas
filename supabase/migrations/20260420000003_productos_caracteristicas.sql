-- Renombra campos desc_* a caracteristica_1..4 (uso en e-commerce)
ALTER TABLE catalogo_productos
  RENAME COLUMN desc_corta      TO caracteristica_1;
ALTER TABLE catalogo_productos
  RENAME COLUMN desc_larga      TO caracteristica_2;
ALTER TABLE catalogo_productos
  RENAME COLUMN desc_materiales TO caracteristica_3;
ALTER TABLE catalogo_productos
  RENAME COLUMN desc_instalacion TO caracteristica_4;
