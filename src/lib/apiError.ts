import { toast } from 'sonner';

// El backend (validateBody, server/src/lib/validate.ts) devuelve errores de Zod como
// { error: 'Datos inválidos', detalle: [{ campo: 'items.2.descripcion', mensaje: '...' }] }
// y src/lib/api.ts ya adjunta ese detalle al Error que tira ( e.detalle ). El problema
// real en los formularios era descartarlo y mostrar solo e.message — "Datos inválidos"
// sin decir de qué campo. Este helper arma un mensaje legible campo por campo para
// no repetir esa traducción en cada pantalla.

export interface ApiErrorDetalle { campo: string; mensaje: string }
export interface ApiError extends Error { detalle?: ApiErrorDetalle[] }

export interface ErrorApiFormateado {
  titulo: string;
  lineas: string[];
  /** Índice de ítem (dentro de un array `items`) del PRIMER error, si aplica — útil para
   *  abrir directo el ítem con problema en vez de dejar al usuario a adivinar cuál es. */
  primerItemIdx: number | null;
}

export interface FormatearErrorApiOpts {
  /** Mensaje a usar cuando no hay detalle Y el error tampoco trae message propio. */
  fallback?: string;
  labelCampo?: (campo: string) => string;
  labelItem?: (idx: number) => string;
}

/**
 * Traduce el detalle de error del backend a algo mostrable. Sin `detalle` (error de red,
 * 500, un endpoint que no valida con Zod, etc.) cae al mensaje del error o al fallback
 * del llamador — no rompe nada de lo ya existente.
 *
 * `labelCampo` traduce el último segmento del path (ej. "descripcion" → "Descripción").
 * `labelItem` traduce el índice de un array `items.N.*` a una etiqueta legible (ej. con
 * la descripción real de esa fila) — sin él usa "Ítem N".
 */
export function formatearErrorApi(e: unknown, opts?: FormatearErrorApiOpts): ErrorApiFormateado {
  const err = e as ApiError;
  const detalle = err?.detalle;
  if (!detalle?.length) {
    return { titulo: err?.message || opts?.fallback || 'Error al guardar', lineas: [], primerItemIdx: null };
  }

  let primerItemIdx: number | null = null;
  const lineas = detalle.map(d => {
    const partes = d.campo.split('.');
    if (partes[0] === 'items' && partes.length >= 2 && !Number.isNaN(Number(partes[1]))) {
      const idx = Number(partes[1]);
      if (primerItemIdx === null) primerItemIdx = idx;
      const campoItem = partes.slice(2).join('.') || 'datos';
      const etiquetaItem = opts?.labelItem?.(idx) ?? `Ítem ${idx + 1}`;
      const etiquetaCampo = opts?.labelCampo?.(campoItem) ?? campoItem;
      return `${etiquetaItem} — ${etiquetaCampo}: ${d.mensaje}`;
    }
    const etiquetaCampo = opts?.labelCampo?.(d.campo) ?? d.campo;
    return `${etiquetaCampo}: ${d.mensaje}`;
  });

  return { titulo: 'Revisá estos datos', lineas, primerItemIdx };
}

/**
 * Atajo de una línea para el caso más común: mostrar el error como toast.
 * Con detalle, muestra un título + la lista de campos con problema (varias líneas,
 * sonner las soporta bien en `description`). Sin detalle, cae al toast de siempre.
 */
export function toastApiError(e: unknown, opts?: FormatearErrorApiOpts & { duration?: number }) {
  const { titulo, lineas } = formatearErrorApi(e, opts);
  if (lineas.length) {
    toast.error(titulo, { description: lineas.join('\n'), duration: opts?.duration ?? 10000 });
  } else {
    toast.error(titulo);
  }
}

// Etiquetas en español para los campos de los schemas Zod del backend
// (server/src/lib/schemas.ts) — se usan como `labelCampo` para traducir el path
// técnico del error a algo que el usuario reconozca en la pantalla.
export const CAMPO_LABELS: Record<string, string> = {
  // Genérico / ítems de línea (presupuestos, recibos, pedidos, remitos, venta rápida)
  items: 'Ítems',
  descripcion: 'Descripción',
  cantidad: 'Cantidad',
  monto: 'Monto',
  precio_unitario: 'Precio unitario',
  costo_unitario: 'Precio costo',
  precio_lista: 'Precio de lista',
  precio_instalacion: 'Precio instalación',
  costo_instalacion: 'Costo instalación',
  incluye_instalacion: 'Instalación',
  medida_ancho: 'Ancho',
  medida_alto: 'Alto',
  producto_id: 'Producto',
  servicio_id: 'Servicio',
  tipo_abertura_id: 'Tipo de abertura',
  sistema_id: 'Sistema',
  color: 'Color',
  vidrio: 'Vidrio',
  premarco: 'Premarco',
  origen: 'Origen',
  accesorios: 'Accesorios',
  notas: 'Notas',
  notas_internas: 'Notas internas',
  notas_item: 'Notas del ítem',
  calculo_url: 'Cálculo adjunto',
  tipo_item: 'Tipo de ítem',
  es_reposicion: 'Reposición',
  operacion_item_id: 'Ítem de origen',

  // Cliente
  cliente_id: 'Cliente',
  tipo_persona: 'Tipo de persona',
  nombre: 'Nombre',
  apellido: 'Apellido',
  razon_social: 'Razón social',
  documento_nro: 'Documento',
  telefono: 'Teléfono',
  telefono_fijo: 'Teléfono fijo',
  email: 'Email',
  email_alternativo: 'Email alternativo',
  direccion: 'Dirección',
  localidad: 'Localidad',
  codigo_postal: 'Código postal',
  provincia: 'Provincia',
  estado: 'Estado',
  fecha_nacimiento: 'Fecha de nacimiento',
  genero: 'Género',
  estado_civil: 'Estado civil',
  preferencia_contacto: 'Preferencia de contacto',
  acepta_marketing: 'Acepta marketing',
  referido_por_id: 'Referido por',
  categoria_id: 'Categoría',
  asignado_a: 'Asignado a',
  dom_obra: 'Domicilio de obra',
  dom_obra_localidad: 'Localidad de obra',
  dom_alternativo: 'Domicilio alternativo',
  dom_alternativo_localidad: 'Localidad alternativa',
  dom_alternativo_cp: 'CP alternativo',
  dom_alternativo_referencia: 'Referencia domicilio alternativo',
  condicion_iva: 'Condición de IVA',
  crm_etapa: 'Etapa CRM',
  interes: 'Interés',

  // Operación / presupuesto
  tipo: 'Tipo',
  vendedor_id: 'Vendedor',
  proveedor_id: 'Proveedor',
  tipo_proyecto: 'Tipo de proyecto',
  forma_pago: 'Forma de pago',
  forma_pago_alternativa_id: 'Forma de pago alternativa',
  forma_envio: 'Forma de envío',
  costo_envio: 'Costo de envío',
  fecha_validez: 'Fecha de validez',
  tiempo_entrega: 'Tiempo de entrega',
  visita_tecnica_id: 'Visita técnica',
  formas_pago_alternativas: 'Formas de pago alternativas',
  motivo_rechazo: 'Motivo de rechazo',

  // Recibo
  operacion_id: 'Operación',
  remito_id: 'Remito',
  monto_total: 'Monto total',
  fecha: 'Fecha',
  referencia_pago: 'Referencia de pago',
  concepto: 'Concepto',
  compromiso: 'Compromiso de pago',
  descuento_pct: 'Descuento %',
  monto_lista: 'Monto de lista',
  monto_descuento: 'Descuento',
  comprobante_url: 'Comprobante',
  fecha_vencimiento: 'Fecha de vencimiento',

  // Pedido
  es_stock_propio: 'Stock propio',
  fecha_pedido: 'Fecha de pedido',
  fecha_entrega_est: 'Fecha de entrega estimada',
  referencia_nro: 'N° de referencia',
  transportista_id: 'Transportista',
  costo_envio_real: 'Costo de envío real',
  fecha_recepcion: 'Fecha de recepción',

  // Visita técnica
  cobrar: 'Cobro de la visita',
  ambiente: 'Ambiente',
  ancho_mm: 'Ancho (mm)',
  alto_mm: 'Alto (mm)',
  fecha_visita: 'Fecha de visita',
  tecnico: 'Técnico',
  instalacion: 'Instalación',
  abertura_especial: 'Abertura especial',
  observaciones: 'Observaciones',
  imagenes: 'Imágenes',
  firma_url: 'Firma',
  costo_externo: 'Costo externo',

  // Oportunidades
  operacion_id_origen: 'Presupuesto de origen',
  motivo: 'Motivo',
  fecha_recontacto: 'Fecha de recontacto',
  probabilidad: 'Probabilidad',
  motivo_cierre: 'Motivo de cierre',
  operacion_id_ganada: 'Presupuesto ganado',
  canal: 'Canal',
  mensaje: 'Mensaje',

  // Catálogo (tipos de abertura, sistemas, colores, servicios, formas de pago, categorías, modelos)
  icono: 'Ícono',
  orden: 'Orden',
  activo: 'Activo',
  margen_venta: 'Margen de venta',
  material: 'Material',
  hex: 'Color (hex)',
  precio_base: 'Precio base',
  parent_id: 'Categoría padre',

  // Proveedores
  contacto: 'Contacto',
  cuit: 'CUIT',
  web: 'Sitio web',
  materiales: 'Materiales',
  forma_entrega: 'Forma de entrega',
  plazo_entrega_dias: 'Plazo de entrega (días)',
  costo_flete: 'Costo de flete',
  calificacion: 'Calificación',
  deuda_actual: 'Deuda actual',
  es_principal: 'Proveedor principal',
  sku: 'SKU',
  precio: 'Precio',

  // Remitos
  medio_envio: 'Medio de envío',
  transportista: 'Transportista',
  nro_seguimiento: 'N° de seguimiento',
  direccion_entrega: 'Dirección de entrega',
  fecha_emision: 'Fecha de emisión',
  fecha_entrega_real: 'Fecha de entrega real',
  estado_producto: 'Estado del producto',
  hora_entrega_est: 'Hora de entrega estimada',

  // Venta rápida
  retira: 'Retira',
  medio_envio_rapida: 'Medio de envío',

  // Stock
  producto_id_stock: 'Producto',
  lote_id: 'Lote',
  fecha_ingreso: 'Fecha de ingreso',
  remito_nro: 'N° de remito',
  factura_nro: 'N° de factura',
  notas_lote: 'Notas del lote',

  // Usuarios / login
  password: 'Contraseña',
  rol: 'Rol',
};
