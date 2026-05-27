-- Plantillas de mensajes WhatsApp editables desde Configuración
CREATE TABLE IF NOT EXISTS mensajes_plantilla (
  clave      VARCHAR(50) PRIMARY KEY,
  titulo     VARCHAR(100) NOT NULL,
  contenido  TEXT NOT NULL,
  variables  TEXT NOT NULL DEFAULT ''  -- documentación de variables disponibles
);

INSERT INTO mensajes_plantilla (clave, titulo, contenido, variables) VALUES

('pedido_proveedor',
 'Pedido al proveedor',
 E'🏠 *Pedido de Productos — César Brítez Aberturas*\nFormosa, Argentina{{ref_operacion}}\n\n📋 *Detalle del pedido {{numero}}:*\n\n{{detalle}}{{fecha_entrega}}\n\nMuchas gracias por su atención. Aguardamos confirmación de recepción.',
 '{{numero}}, {{detalle}}, {{ref_operacion}}, {{fecha_entrega}}'
),

('presupuesto_aprobacion',
 'Presupuesto para aprobación',
 E'Hola {{nombre}}, te enviamos el presupuesto *{{numero}}* para tu revisión.\n\nPodés aprobarlo desde este enlace:\n{{url}}',
 '{{nombre}}, {{numero}}, {{url}}'
),

('remito_cliente',
 'Remito al cliente',
 E'Hola {{nombre}}, adjuntamos el remito *{{numero}}* de tu pedido.\n\nPodés descargarlo desde:\n{{url}}',
 '{{nombre}}, {{numero}}, {{url}}'
)

ON CONFLICT (clave) DO NOTHING;
