-- Documenta el schema esperado de la columna atributos JSONB
-- Los valores provienen de constantes controladas en el frontend (NuevoProducto.tsx)
-- para garantizar consistencia. No usar INSERT directo sin respetar estos valores.

COMMENT ON COLUMN catalogo_productos.atributos IS
'Schema por tipo de abertura:

PUERTAS (tipo_abertura.nombre ILIKE %puerta%):
  tipo_puerta       TEXT  -- aluminio|placa|chapa_simple|chapa_inyectada|plegable_pvc|granero|corrediza_oculta|embutir
  uso               TEXT  -- interior|exterior|ingreso_frente
  config_hojas      TEXT  -- hoja_simple|hoja_y_media|dos_hojas|puerta_pano_fijo
  ancho_hoja        INT   -- 80|85|90 (cm)
  hoja_principal    TEXT  -- izquierda|derecha
  tipo_provision    TEXT  -- hoja_sola|hoja_marco|kit_completo
  estructura        TEXT  -- aluminio_completo|placa_marco_chapa|placa_marco_aluminio|chapa_simple|chapa_inyectada|pvc|mdf|madera
  linea             TEXT  -- herrero|modena|a30  (solo aluminio)
  espesor           TEXT  -- "25 mm"|"36 mm"     (solo herrero)
  modelo            TEXT  -- Ciega|Vidriada|1/2 vidrio|... (según tipo_puerta)
  modelo_comercial  TEXT  -- Pino|Cedrillo|Camden|Craftmaster|Otro  (solo placa)
  subtipo_granero   TEXT  -- mdf|aluminio  (solo granero)
  diseno_hoja       TEXT  -- Lisa|Repartida
  config_estructural TEXT -- Simple|Con lateral fijo
  apertura          TEXT  -- de_abrir|corrediza|plegable|embutir
  vidrio_incluye    BOOL
  vidrio_tipo       TEXT  -- Transparente|Laminado|Doble vidrio (DVH)
  vidrio_formato    TEXT  -- Entero|1/2|1/4
  herrajes          TEXT  -- picaporte|barral_medio_picaporte|corredizo_oculto|corredizo_expuesto|sistema_plegable
  cerradura         BOOL
  componentes       TEXT[] -- herrajes_completos|burleteria_felpa|sellado|embalado
  instalacion       TEXT  -- si|no|opcional
  entrega           TEXT[] -- retiro_local|envio_disponible

Medidas (cm) se almacenan en columnas ancho/alto de catalogo_productos.
';

INSERT INTO schema_migrations (filename) VALUES ('20260424000002_catalogo_atributos_schema.sql')
  ON CONFLICT DO NOTHING;
