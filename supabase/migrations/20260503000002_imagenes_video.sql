-- Galería de imágenes (array ordenado) y video para tienda online
ALTER TABLE catalogo_productos
  ADD COLUMN IF NOT EXISTS imagenes JSONB    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS video_url  TEXT   DEFAULT NULL;

-- Migrar imagen_url existente al primer slot de imagenes donde aún no hay datos
UPDATE catalogo_productos
  SET imagenes = jsonb_build_array(imagen_url)
  WHERE imagen_url IS NOT NULL
    AND (imagenes IS NULL OR jsonb_array_length(imagenes) = 0);

COMMENT ON COLUMN catalogo_productos.imagenes   IS 'Array ordenado de URLs. [0] = imagen principal mostrada en catálogo y tienda.';
COMMENT ON COLUMN catalogo_productos.video_url  IS 'URL de video del producto (YouTube, Vimeo o archivo directo) para galería tienda.';

INSERT INTO schema_migrations (filename) VALUES ('20260503000002_imagenes_video.sql')
  ON CONFLICT DO NOTHING;
