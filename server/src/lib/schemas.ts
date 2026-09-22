import { z } from 'zod';
import { zUUID, zEmail, zPhone, zText, zPosNum, zPct } from './validate.js';

// ── Auth ───────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// ── Clientes ───────────────────────────────────────────────────
export const ClienteSchema = z.object({
  tipo_persona:           z.enum(['fisica', 'juridica']),
  nombre:                 zText(120).optional(),
  apellido:               zText(120).optional(),
  razon_social:           zText(200).optional(),
  documento_nro:          zText(30).optional(),
  telefono:               zPhone,
  telefono_fijo:          zPhone,
  email:                  zEmail,
  email_alternativo:      zEmail,
  direccion:              zText(255).optional(),
  localidad:              zText(120).optional(),
  codigo_postal:          zText(20).optional(),
  provincia:              zText(120).optional(),
  estado:                 zText(50).optional(),
  origen:                 zText(100).optional(),
  fecha_nacimiento:       z.string().optional().nullable(),
  genero:                 zText(30).optional(),
  estado_civil:           zText(30).optional(),
  preferencia_contacto:   zText(50).optional(),
  acepta_marketing:       z.boolean().optional(),
  referido_por_id:        zUUID.optional().nullable(),
  notas:                  zText(2000).optional(),
  categoria_id:           zUUID.optional().nullable(),
  asignado_a:             zUUID.optional().nullable(),
  dom_obra:               zText(255).optional(),
  dom_obra_localidad:     zText(120).optional(),
  dom_alternativo:        zText(255).optional(),
  dom_alternativo_localidad: zText(120).optional(),
  dom_alternativo_cp:     zText(20).optional(),
  dom_alternativo_referencia: zText(255).optional(),
  condicion_iva:          zText(50).optional(),
  crm_etapa:              zText(50).optional(),
  interes:                zText(200).optional(),
}).refine(d => {
  if (d.tipo_persona === 'fisica')   return !!(d.nombre || d.apellido);
  if (d.tipo_persona === 'juridica') return !!d.razon_social;
  return true;
}, { message: 'Nombre/apellido requerido para persona física; razón social para jurídica' });

// ── Operaciones (presupuestos) ─────────────────────────────────
const OperacionItemSchema = z.object({
  tipo_abertura_id:    zUUID.optional().nullable(),
  sistema_id:          zUUID.optional().nullable(),
  producto_id:         zUUID.optional().nullable(),
  descripcion:         z.string().min(1, 'Descripción requerida').max(500),
  cantidad:            z.number().int().positive('Cantidad debe ser > 0'),
  costo_unitario:      zPosNum.optional().default(0),
  precio_unitario:     zPosNum,
  precio_lista:        zPosNum.optional().nullable(),
  costo_instalacion:   zPosNum.optional().default(0),
  precio_instalacion:  zPosNum.optional().default(0),
  incluye_instalacion: z.boolean().optional().default(false),
  medida_ancho:        z.number().positive().optional().nullable(),
  medida_alto:         z.number().positive().optional().nullable(),
  color:               zText(100).optional(),
  vidrio:              zText(100).optional(),
  premarco:            z.boolean().optional().default(false),
  origen:              zText(100).optional(),
  accesorios:          z.array(z.string()).optional().default([]),
  notas:               zText(500).optional(),
  calculo_url:         zText(300).optional().nullable(),
  tipo_item:           z.enum(['estandar', 'a_medida', 'servicio', 'a_relevar']).optional().default('estandar'),
  servicio_id:         zUUID.optional().nullable(),
});

const OperacionFormaPagoSchema = z.object({
  forma_pago_id: zUUID.optional().nullable(),
  nombre:        z.string().min(1, 'Nombre requerido').max(150),
  descuento_pct: z.number().min(0).max(100).optional().default(0),
  orden:         z.number().int().nonnegative().optional().default(0),
});

export const OperacionSchema = z.object({
  tipo:             z.enum(['estandar', 'a_medida_proveedor', 'fabricacion_propia']).optional().default('a_medida_proveedor'),
  estado:           z.string().optional(),
  cliente_id:       zUUID,
  vendedor_id:      zUUID.optional().nullable(),
  proveedor_id:     zUUID.optional().nullable(),
  tipo_proyecto:    zText(200).optional(),
  forma_pago:       zText(100).optional(),
  forma_envio:      z.enum(['retiro_local','envio_bonificado','envio_destino','envio_empresa']).optional().nullable(),
  costo_envio:      zPosNum.optional().default(0),
  fecha_validez:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)').optional().nullable(),
  tiempo_entrega:   z.number().int().positive().optional().nullable(),
  notas:            zText(2000).optional(),
  notas_internas:   zText(2000).optional(),
  items:            z.array(OperacionItemSchema).min(1, 'Se requiere al menos 1 ítem'),
  visita_tecnica_id: zUUID.optional().nullable(),
  formas_pago_alternativas: z.array(OperacionFormaPagoSchema).optional().default([]),
  /**
   * Solo en PUT: por qué se está editando. Se guarda en la versión que este cambio
   * reemplaza, para poder contar aparte las modificaciones que pidió el cliente
   * (las únicas que se le muestran en la proforma y el link público).
   */
  version_origen:   z.enum(['cliente', 'interna']).optional().default('interna'),
});

export const EstadoOperacionSchema = z.object({
  estado: z.enum(['presupuesto','enviado','aprobado','en_produccion','listo','instalado','entregado','cancelado','rechazado']),
  motivo_rechazo: zText(500).optional(),
});

// ── Recibos ────────────────────────────────────────────────────
const ReciboItemSchema = z.object({
  descripcion: z.string().min(1).max(500),
  producto_id: z.string().optional().nullable(),
  cantidad:    z.number().int().positive().optional(),
  monto:       zPosNum,
});

const ReciboCompromisoSchema = z.object({
  monto:            z.number().positive(),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo:             zText(50).optional(),
  descripcion:      zText(500).optional(),
}).optional().nullable();

// Un medio de pago dentro de un recibo combinado. Solo se manda cuando el cobro se
// reparte entre 2 o más medios; con uno solo alcanza con forma_pago/referencia_pago.
const ReciboPagoSchema = z.object({
  forma_pago: z.string().min(1, 'Forma de pago requerida').max(150),
  monto:      z.number().positive('El monto de cada medio de pago debe ser > 0'),
  referencia: zText(200).optional().nullable(),
});

export const ReciboSchema = z.object({
  cliente_id:      zUUID,
  operacion_id:    zUUID.optional().nullable(),
  remito_id:       zUUID.optional().nullable(),
  monto_total:     z.number().positive('Monto debe ser > 0'),
  forma_pago:      z.string().min(1, 'Forma de pago requerida').max(150),
  forma_pago_alternativa_id: zUUID.optional().nullable(),
  fecha:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referencia_pago: zText(200).optional(),
  concepto:        zText(500).optional(),
  notas:           zText(1000).optional(),
  items:           z.array(ReciboItemSchema).optional().default([]),
  /** Desglose cuando el cobro se reparte entre varios medios. Con 0 o 1 entrada se
   *  ignora y el recibo queda como uno simple. La suma se valida en la ruta. */
  pagos:           z.array(ReciboPagoSchema).max(10).optional(),
  compromiso:      ReciboCompromisoSchema,
  descuento_pct:   z.number().min(0).max(100).optional().default(0),
  monto_lista:     z.number().min(0).optional().default(0),
  monto_descuento: z.number().min(0).optional().default(0),
  comprobante_url: zText(300).optional().nullable(),
  comprobantes:    z.array(z.string().max(300)).max(10).optional(),
});

// ── Pedidos al proveedor ───────────────────────────────────────
const PedidoItemSchema = z.object({
  operacion_item_id: zUUID.optional().nullable(),
  producto_id:       zUUID.optional().nullable(),
  descripcion:       z.string().min(1).max(500),
  cantidad:          z.number().int().positive(),
  costo_unitario:    zPosNum,
  orden:             z.number().int().optional(),
  es_reposicion:     z.boolean().optional().default(false),
});

export const PedidoSchema = z.object({
  proveedor_id:      zUUID,
  operacion_id:      zUUID.optional().nullable(),
  es_stock_propio:   z.boolean().optional().default(false),
  fecha_pedido:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_entrega_est: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  costo_envio:       zPosNum.optional(),
  notas:             zText(2000).optional(),
  referencia_nro:    zText(100).optional(),
  items:             z.array(PedidoItemSchema).min(1, 'Se requiere al menos 1 ítem'),
});

export const PedidoEstadoSchema = z.object({
  estado:           z.enum(['pendiente','enviado','recibido','cancelado']),
  fecha_recepcion:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  transportista_id: z.string().uuid().optional().nullable(),
  costo_envio_real: z.number().min(0).optional().nullable(),
});

// ── Compras: SC → PC → OC (docs/compras-plan.md) ──────────────────────────────
const zFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');
const zAdjuntos = z.array(z.string().max(300)).max(20);

export const ORIGENES_COMPRA = [
  'venta', 'proforma', 'orden_trabajo', 'reposicion_stock',
  'produccion_propia', 'faltante', 'garantia', 'reposicion_falla',
] as const;
export const TIPOS_PRODUCTO_COMPRA = [
  'abertura_estandar', 'abertura_medida', 'perfil', 'vidrio', 'herraje_accesorio', 'otro',
] as const;
export const UNIDADES_COMPRA = ['u', 'm', 'm2', 'kg'] as const;
export const IVA_PCTS = [0, 10.5, 21, 27] as const;
export const DISPONIBILIDADES_COMPRA = ['inmediata', 'a_fabricar', 'parcial', 'sin_stock'] as const;
export const MEDIOS_ENVIO_COMPRA = ['whatsapp', 'email', 'manual'] as const;

const zIvaPct = z.number().refine(v => (IVA_PCTS as readonly number[]).includes(v), 'IVA debe ser 0, 10.5, 21 o 27');
const zDescPct = z.number().min(0).max(100);

// Claves esperadas de la ficha técnica según el tipo de producto (se valida que las que
// vengan tengan el tipo correcto; ninguna es obligatoria porque el origen puede no tenerla).
const ESPEC_NUM: Record<string, string[]> = {
  abertura_estandar: ['ancho_m', 'alto_m'],
  abertura_medida:   ['ancho_m', 'alto_m'],
  perfil:            ['largo_mm', 'cantidad_barras'],
  vidrio:            ['espesor_mm', 'ancho_mm', 'alto_mm', 'cantidad'],
  herraje_accesorio: [],
  otro:              [],
};

export const SolicitudItemSchema = z.object({
  operacion_item_id:      zUUID.optional().nullable(),
  visita_tecnica_item_id: zUUID.optional().nullable(),
  producto_id:            zUUID.optional().nullable(),
  descripcion:            z.string().trim().min(1, 'Descripción requerida').max(500),
  cantidad:               z.number().positive('La cantidad debe ser mayor a 0'),
  unidad:                 z.enum(UNIDADES_COMPRA).optional().default('u'),
  especificaciones:       z.record(z.string(), z.unknown()).optional().default({}),
  adjuntos:               zAdjuntos.optional().default([]),
  observaciones:          zText(1000).optional(),
});

export const SolicitudCompraSchema = z.object({
  origen:                z.enum(ORIGENES_COMPRA),
  operacion_id:          zUUID.optional().nullable(),
  visita_tecnica_id:     zUUID.optional().nullable(),
  cliente_id:            zUUID.optional().nullable(),
  obra:                  zText(200).optional(),
  tipo_producto:         z.enum(TIPOS_PRODUCTO_COMPRA),
  fecha_necesaria:       zFecha.optional().nullable(),
  observaciones:         zText(2000).optional(),
  adjuntos:              zAdjuntos.optional().default([]),
  proveedor_sugerido_id: zUUID.optional().nullable(),
  items:                 z.array(SolicitudItemSchema).min(1, 'Se requiere al menos 1 ítem'),
}).superRefine((b, ctx) => {
  const numericas = ESPEC_NUM[b.tipo_producto] ?? [];
  b.items.forEach((it, i) => {
    for (const k of numericas) {
      const v = it.especificaciones[k];
      if (v !== undefined && v !== null && v !== '' && (typeof v !== 'number' || !(v > 0))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'especificaciones', k],
          message: `${k} debe ser un número mayor a 0`,
        });
      }
    }
  });
});

export const SolicitudEstadoSchema = z.object({
  estado: z.enum(['cancelada', 'cerrada', 'abierta']),
  motivo: zText(500).optional(),
});

export const CotizacionCrearSchema = z.object({
  solicitud_id:  zUUID,
  item_ids:      z.array(zUUID).min(1, 'Elegí al menos un ítem'),
  proveedor_ids: z.array(zUUID).min(1, 'Elegí al menos un proveedor'),
  fecha_limite:  zFecha.optional().nullable(),
  observaciones: zText(2000).optional(),
});

const CotizacionRespuestaItemSchema = z.object({
  solicitud_item_id:    zUUID,
  precio_unitario_neto: zPosNum,
  descuento_pct:        zDescPct.optional().default(0),
  iva_pct:              zIvaPct.optional().default(21),
  plazo_dias:           z.number().int().min(0).optional().nullable(),
  disponibilidad:       z.enum(DISPONIBILIDADES_COMPRA).optional().nullable(),
  observaciones:        zText(500).optional(),
});

export const CotizacionRespuestaSchema = z.object({
  subtotal_neto:   zPosNum.optional(),
  descuento_monto: zPosNum.optional().default(0),
  iva_pct:         zIvaPct.optional().default(21),
  iva_monto:       zPosNum.optional(),
  flete:           zPosNum.optional().default(0),
  plazo_dias:      z.number().int().min(0).optional().nullable(),
  disponibilidad:  z.enum(DISPONIBILIDADES_COMPRA).optional().nullable(),
  forma_pago:      zText(200).optional(),
  validez_hasta:   zFecha.optional().nullable(),
  observaciones:   zText(2000).optional(),
  archivo_url:     zText(300).optional(),
  adjuntos:        zAdjuntos.optional(),
  sin_respuesta:   z.boolean().optional().default(false),
  items:           z.array(CotizacionRespuestaItemSchema).optional(),
}).superRefine((b, ctx) => {
  if (b.sin_respuesta) return;
  if ((!b.items || b.items.length === 0) && b.subtotal_neto === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subtotal_neto'], message: 'Cargá el total neto o los precios por ítem' });
  }
});

export const CotizacionAdjudicarSchema = z.object({
  proveedor_id:    zUUID,
  fecha_prometida: zFecha.optional().nullable(),
  notas:           zText(2000).optional(),
});

export const CotizacionCerrarSchema = z.object({
  motivo: z.string().trim().min(1, 'Indicá el motivo').max(500),
});

const OrdenItemPrecioSchema = z.object({
  solicitud_item_id:    zUUID,
  cantidad:             z.number().positive().optional(),
  precio_unitario_neto: zPosNum.optional().default(0),
  descuento_pct:        zDescPct.optional().default(0),
  iva_pct:              zIvaPct.optional().default(21),
  proveedor_sku:        zText(100).optional(),
});

const OrdenCabeceraSchema = {
  proveedor_id:       zUUID,
  costo_envio:        zPosNum.optional().default(0),
  forma_pago:         zText(200).optional(),
  contacto_proveedor: zText(200).optional(),
  fecha_prometida:    zFecha.optional().nullable(),
  notas:              zText(2000).optional(),
  items:              z.array(OrdenItemPrecioSchema).min(1, 'Elegí al menos un ítem'),
};

export const OrdenDirectaSchema = z.object({
  solicitud_id: zUUID,
  ...OrdenCabeceraSchema,
});

export const OrdenConsolidarSchema = z.object(OrdenCabeceraSchema);

export const OrdenEditarSchema = z.object({
  costo_envio:        zPosNum.optional(),
  forma_pago:         zText(200).optional(),
  contacto_proveedor: zText(200).optional(),
  fecha_prometida:    zFecha.optional().nullable(),
  notas:              zText(2000).optional(),
  adjuntos:           zAdjuntos.optional(),
  items: z.array(z.object({
    id:                   zUUID,
    cantidad:             z.number().positive().optional(),
    precio_unitario_neto: zPosNum.optional(),
    descuento_pct:        zDescPct.optional(),
    iva_pct:              zIvaPct.optional(),
    proveedor_sku:        zText(100).optional(),
  })).optional(),
});

export const EnviarCompraSchema = z.object({
  medio:        z.enum(MEDIOS_ENVIO_COMPRA),
  proveedor_id: zUUID.optional(),
  contacto:     zText(200).optional(),
  mensaje:      zText(4000).optional(),
});

// ── Visitas técnicas ──────────────────────────────────────────
export const VisitaTecnicaCrearSchema = z.object({
  cliente_id:      zUUID,
  cobrar:          z.boolean().optional().default(false),
  forma_pago:      z.string().min(1).max(150).optional(),
  referencia_pago: zText(200).optional(),
  // Presupuesto ya guardado, con ítems identificados, al que le falta relevar
  // uno o más ítems en el sitio. Si viene, la visita queda ligada desde el
  // arranque (no recién al convertirla) y "completar" agrega ítems a esa
  // operación en vez de crear una nueva.
  operacion_id:    zUUID.optional().nullable(),
}).refine(b => !b.cobrar || !!b.forma_pago?.trim(), {
  message: 'Elegí la forma de pago de la visita',
  path: ['forma_pago'],
});

// Ítems relevados que se agregan a un presupuesto YA EXISTENTE (visita
// vinculada desde el arranque) — mismo shape que arma CargarVisitaTecnica.tsx
// al "avanzar", pero en vez de precargar un presupuesto nuevo, se insertan
// directo como operacion_items.
const ItemRelevadoSchema = z.object({
  descripcion:      zText(500),
  medida_ancho:     z.string().optional(),
  medida_alto:      z.string().optional(),
  tipo_item:        z.enum(['a_medida', 'servicio', 'estandar']).optional().default('a_medida'),
  producto_id:      zUUID.optional().nullable(),
  servicio_id:      zUUID.optional().nullable(),
  tipo_abertura_id: zUUID.optional().nullable(),
  sistema_id:       zUUID.optional().nullable(),
  vidrio:           zText(100).optional(),
  premarco:         z.boolean().optional().default(false),
  accesorios:       z.array(z.string()).optional().default([]),
  color:            zText(100).optional(),
  calculo_url:      zText(300).optional().nullable(),
});

export const CompletarRelevamientoSchema = z.object({
  visita_tecnica_id: zUUID,
  items: z.array(ItemRelevadoSchema).min(1),
});

export const VisitaTecnicaCobrarSchema = z.object({
  forma_pago:      z.string().min(1).max(150),
  referencia_pago: zText(200).optional(),
  // Importe a cobrar. Si no viene se usa el costo configurado en empresa. Se acepta
  // explícito para poder corregir visitas viejas: las previas a la feature de cobro
  // tienen costo_cobrado en NULL, y el costo configurado pudo cambiar desde entonces.
  monto:           z.number().positive('El importe debe ser mayor a 0').optional(),
});

export const VisitaTecnicaBonificarSchema = z.object({
  operacion_id: zUUID,
});

export const VisitaTecnicaCostoExternoSchema = z.object({
  costo_externo: z.number().min(0).nullable(),
});

// ── Oportunidades futuras ────────────────────────────────────
export const OportunidadSchema = z.object({
  cliente_id:          zUUID,
  operacion_id_origen: zUUID.optional().nullable(),
  motivo:              z.string().min(3, 'Contá de qué se trata').max(500),
  fecha_recontacto:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  interes:             z.enum(['alto', 'medio', 'bajo']).optional().default('medio'),
  probabilidad:        z.number().int().min(0).max(100).optional().default(50),
  observaciones:       zText(2000).optional(),
  origen:              z.enum(['cliente', 'presupuesto', 'crm', 'publico']).optional().default('crm'),
});

export const OportunidadUpdateSchema = OportunidadSchema.partial().omit({ cliente_id: true });

export const OportunidadPosponerSchema = z.object({
  fecha_recontacto: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  observaciones:     zText(2000).optional(),
});

export const OportunidadEstadoSchema = z.object({
  estado:              z.enum(['pendiente', 'contactada', 'convertida', 'descartada']),
  motivo_cierre:       zText(500).optional(),
  operacion_id_ganada: zUUID.optional().nullable(),
});

export const OportunidadContactoSchema = z.object({
  canal:   z.enum(['whatsapp', 'llamada', 'email']),
  mensaje: zText(2000).optional(),
});

const VisitaTecnicaItemSchema = z.object({
  ambiente:         zText(200).optional(),
  descripcion:      zText(500).optional(),
  ancho_mm:         z.number().positive().optional().nullable(),
  alto_mm:          z.number().positive().optional().nullable(),
  tipo_item:        z.enum(['a_medida', 'servicio', 'estandar']).optional().default('a_medida'),
  producto_id:      zUUID.optional().nullable(),
  servicio_id:      zUUID.optional().nullable(),
  tipo_abertura_id: zUUID.optional().nullable(),
  sistema_id:       zUUID.optional().nullable(),
  vidrio:           zText(100).optional(),
  premarco:         z.boolean().optional().default(false),
  accesorios:       z.array(z.string()).optional().default([]),
  color:            zText(100).optional(),
  calculo_url:      zText(300).optional().nullable(),
});

export const VisitaTecnicaSchema = z.object({
  fecha_visita:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)').optional().nullable(),
  tecnico:           zText(200).optional(),
  color:             z.array(z.string()).optional().default([]),
  vidrio:            z.array(z.string()).optional().default([]),
  instalacion:       z.array(z.string()).optional().default([]),
  abertura_especial: z.array(z.string()).optional().default([]),
  observaciones:     zText(2000).optional(),
  imagenes:          z.array(z.string()).optional().default([]),
  firma_url:         zText(300).optional().nullable(),
  items:             z.array(VisitaTecnicaItemSchema).optional().default([]),
});

// ── Catálogo ───────────────────────────────────────────────────
export const TipoAberturaSchema = z.object({
  nombre:       z.string().min(1).max(120),
  descripcion:  zText(500).optional(),
  icono:        zText(50).optional(),
  orden:        z.number().int().nonnegative().optional(),
  activo:       z.boolean().optional(),
  margen_venta: z.number().min(0).max(100).optional().nullable(),
});

export const SistemaSchema = z.object({
  nombre:      z.string().min(1).max(120),
  material:    zText(100).optional(),
  descripcion: zText(500).optional(),
  activo:      z.boolean().optional(),
});

export const ColorSchema = z.object({
  nombre: z.string().min(1).max(100),
  hex:    z.string().regex(/^#[0-9a-fA-F]{3,6}$/, 'Formato hex inválido (ej: #FF0000)').optional().nullable(),
  activo: z.boolean().optional(),
});

export const MaterialSchema = z.object({
  nombre: z.string().min(1).max(100),
  orden:  z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
});

// Línea comercial (marketing) — no confundir con SistemaSchema, que es el sistema técnico.
export const LineaSchema = z.object({
  nombre: z.string().min(1).max(100),
  orden:  z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
});

export const VidrioSchema = z.object({
  nombre: z.string().min(1).max(100),
  orden:  z.number().int().nonnegative().optional(),
  activo: z.boolean().optional(),
});

export const ServicioSchema = z.object({
  nombre:      z.string().min(1).max(200),
  descripcion: zText(500).optional(),
  precio_base: zPosNum.optional().nullable(),
  orden:       z.number().int().nonnegative().optional(),
  activo:      z.boolean().optional(),
});

export const FormaPagoCatalogoSchema = z.object({
  nombre:        z.string().min(1).max(150),
  descuento_pct: z.number().min(0).max(100).optional().default(0),
  orden:         z.number().int().nonnegative().optional(),
  activo:        z.boolean().optional(),
});

export const CategoriaSchema = z.object({
  nombre:    z.string().min(1).max(120),
  parent_id: zUUID.optional().nullable(),
  orden:     z.number().int().nonnegative().optional(),
  activo:    z.boolean().optional(),
});

export const ModeloSchema = z.object({
  nombre:       z.string().min(1).max(200),
  categoria_id: zUUID.optional().nullable(),
  descripcion:  zText(1000).optional(),
  imagenes:     z.array(z.string()).optional(),
  activo:       z.boolean().optional(),
});

// Claves de la paleta de colores identificatorios de proveedor.
// Debe mantenerse sincronizada con COLORES_PROVEEDOR en src/lib/coloresProveedor.ts
// (el frontend mapea la clave a las clases del badge).
export const CLAVES_COLOR_PROVEEDOR = [
  'violeta', 'celeste', 'esmeralda', 'ambar', 'rosa', 'indigo',
  'teal', 'naranja', 'lima', 'fucsia', 'cian', 'pizarra',
] as const;

export const ProveedorSchema = z.object({
  nombre:             z.string().min(1, 'Nombre requerido').max(200),
  // Clave de la paleta vieja (compatibilidad con lo ya guardado) o un hex libre
  // '#rrggbb' elegido con el selector de color (2026-09-17).
  color:              z.union([z.enum(CLAVES_COLOR_PROVEEDOR), z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')])
                        .optional().nullable(),
  tipo:               z.enum(['Fabricante','Revendedor','Importador']).optional().nullable(),
  contacto:           zText(120).optional(),
  telefono:           zPhone,
  email:              zEmail,
  cuit:               zText(20).optional(),
  direccion:          zText(255).optional(),
  localidad:          zText(120).optional(),
  provincia:          zText(120).optional(),
  web:                zText(255).optional(),
  materiales:         z.array(z.string()).optional().default([]),
  notas:              zText(2000).optional(),
  forma_entrega:      z.enum(['propia','tercerizada','retiro']).optional().default('propia'),
  plazo_entrega_dias: z.number().int().positive().optional().nullable(),
  // costo_flete / deuda_actual / margen_venta son columnas NUMERIC → el driver pg
  // las devuelve como string, y el form de edición reenvía ese valor tal cual
  // cuando el usuario no toca el campo. z.coerce evita el falso "Datos inválidos".
  costo_flete:        z.coerce.number().min(0).max(100).optional().nullable().default(0),
  calificacion:       z.number().int().min(1).max(5).optional().nullable(),
  deuda_actual:       z.coerce.number().nonnegative('Debe ser mayor o igual a 0').optional().nullable().default(0),
  es_principal:       z.boolean().optional().default(false),
  margen_venta:       z.coerce.number().min(0).max(999).optional().nullable().default(0),
  activo:             z.boolean().optional(),
});

export const ProveedorPrecioSchema = z.object({
  sku:         z.string().min(1).max(100),
  descripcion: zText(500).optional(),
  precio:      zPosNum,
  activo:      z.boolean().optional().default(true),
  producto_id: z.string().optional().nullable(),
});

export const ProveedorPrecioPatchSchema = z.object({
  sku:         zText(100).optional(),
  descripcion: zText(500).optional(),
  precio:      zPosNum.optional(),
  activo:      z.boolean().optional(),
  producto_id: z.string().optional().nullable(),
});

// ── Remitos ────────────────────────────────────────────────────
const RemitoItemSchema = z.object({
  producto_id:     z.string().optional().nullable(),
  descripcion:     z.string().min(1).max(500),
  cantidad:        z.number().int().positive(),
  precio_unitario: zPosNum.optional().nullable(),
  estado_producto: z.enum(['nuevo','usado','reparado']).optional().default('nuevo'),
  notas_item:      zText(500).optional(),
  // Ítem del presupuesto que este renglón entrega — lo que permite saber qué
  // queda pendiente cuando la entrega es parcial.
  operacion_item_id: zUUID.optional().nullable(),
});

export const RemitoSchema = z.object({
  cliente_id:       zUUID,
  operacion_id:     zUUID.optional().nullable(),
  medio_envio:      z.string().min(1, 'Medio de envío requerido').max(100),
  transportista:    zText(120).optional(),
  nro_seguimiento:  zText(100).optional(),
  direccion_entrega: zText(255).optional(),
  fecha_emision:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_entrega_est: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notas:            zText(2000).optional(),
  items:            z.array(RemitoItemSchema).min(1, 'Se requiere al menos 1 ítem'),
});

export const RemitoEstadoSchema = z.object({
  estado:             z.enum(['borrador','emitido','entregado','cancelado']),
  fecha_entrega_real: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  // Firma de conformidad, capturada al marcar "entregado" — ver FirmaDigital.tsx.
  firma_url:          zText(300).optional().nullable(),
});

export const RemitoProgramarEntregaSchema = z.object({
  fecha_entrega_est: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_entrega_est:  z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  direccion_entrega: zText(255).optional(),
  notas:             zText(2000).optional(),
});

// ── Venta rápida de mostrador ────────────────────────────────────
const VentaRapidaItemSchema = z.object({
  producto_id:     zUUID,
  descripcion:     z.string().min(1).max(500),
  cantidad:        z.number().int().positive('Cantidad debe ser > 0'),
  precio_unitario: zPosNum,
});

export const VentaRapidaSchema = z.object({
  cliente_id:        zUUID,
  items:             z.array(VentaRapidaItemSchema).min(1, 'Se requiere al menos 1 ítem'),
  forma_pago:        z.enum(['Contado','Tarjeta de débito/crédito en 1 pago','Transferencia','Tarjeta de crédito 3 cuotas sin interés']),
  descuento_pct:     z.number().min(0).max(100).optional().default(0),
  monto_descuento:   zPosNum.optional().default(0),
  retira:            z.boolean().optional().default(true),
  forma_entrega:     z.enum(['retiro_local', 'envio_domicilio']).optional().default('retiro_local'),
  direccion_entrega: zText(300).optional(),
  medio_envio:       z.enum(['encomienda', 'flete_propio', 'flete_tercero', 'correo_argentino', 'otro']).optional(),
  costo_envio:       zPosNum.optional().default(0),
});

// ── Stock ──────────────────────────────────────────────────────
export const StockIngresarSchema = z.object({
  producto_id:   zUUID,
  cantidad:      z.number().int().positive('Cantidad debe ser > 0'),
  lote_id:       z.string().optional().nullable(),
  proveedor_id:  z.string().optional().nullable(),
  fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  remito_nro:    zText(50).optional(),
  factura_nro:   zText(50).optional(),
  notas_lote:    zText(500).optional(),
  costo_unitario: zPosNum.optional().nullable(),
  notas:         zText(500).optional(),
});

export const StockEgresarSchema = z.object({
  producto_id:   zUUID,
  cantidad:      z.number().int().positive('Cantidad debe ser > 0'),
  tipo:          z.enum(['egreso_remito','egreso_retiro','devolucion']),
  lote_id:       z.string().optional().nullable(),
  operacion_id:  z.string().optional().nullable(),
  referencia_nro: zText(50).optional(),
  motivo:        zText(200).optional(),
  notas:         zText(500).optional(),
});

export const StockAjustarSchema = z.object({
  producto_id: zUUID,
  cantidad:    z.number().int('Debe ser entero'),
  motivo:      zText(200).optional(),
  notas:       zText(500).optional(),
});

// ── Usuarios ───────────────────────────────────────────────────
export const UsuarioSchema = z.object({
  nombre:   z.string().min(1, 'Nombre requerido').max(120),
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña debe tener al menos 8 caracteres').optional(),
  rol:      z.enum(['admin','vendedor','consulta']),
  activo:   z.boolean().optional(),
});

// ── Productos ─────────────────────────────────────────────────────────────────
// productos.ts era el único CRUD que leía c.req.json() crudo. El schema es
// deliberadamente permisivo en tipos (coerce en numéricos, nullish en casi todo)
// porque el frontend manda null/'' según el campo — el objetivo es rechazar basura
// (nombre vacío, tipo inexistente, precio negativo, arrays donde va un string), no
// cambiar qué acepta la app. Los campos derivados (imagen_url ← imagenes[0]) se
// siguen calculando en la ruta.
const numOpt = z.coerce.number().finite().nullish();
const strOpt = z.string().max(2000).nullish();
const uuidOpt = z.string().uuid().nullish().or(z.literal('').transform(() => null));

export const ProductoSchema = z.object({
  nombre:           z.string().trim().min(1, 'El nombre es obligatorio').max(300),
  descripcion:      strOpt,
  tipo:             z.enum(['estandar', 'a_medida_proveedor', 'fabricacion_propia']),
  tipo_abertura_id: uuidOpt,
  sistema_id:       uuidOpt,
  material:         strOpt,
  color:            strOpt,
  ancho:            numOpt,
  alto:             numOpt,
  stock_inicial:    z.coerce.number().int().nullish(),
  stock_minimo:     z.coerce.number().int().min(0).nullish(),
  proveedor_id:     uuidOpt,
  proveedor_sku:    strOpt,
  margen_venta:     numOpt,
  precio_manual:    z.boolean().nullish(),
  costo_base:       z.coerce.number().min(0).nullish(),
  precio_base:      z.coerce.number().min(0).nullish(),
  precio_por_m2:    z.boolean().nullish(),
  codigo:           strOpt,
  caracteristica_1: strOpt,
  caracteristica_2: strOpt,
  caracteristica_3: strOpt,
  caracteristica_4: strOpt,
  vidrio:           strOpt,
  premarco:         z.boolean().nullish(),
  accesorios:       z.array(z.string()).nullish(),
  activo:           z.boolean().nullish(),
  en_salon:         z.boolean().nullish(),
  publicado_web:    z.boolean().nullish(),
  nombre_web:       strOpt,
  atributos:        z.record(z.string(), z.unknown()).nullish(),
  etiqueta:         z.enum(['mas_vendido', 'recomendado', 'nuevo']).nullish().or(z.literal('').transform(() => null)),
  margen_tipo:      z.enum(['bajo', 'medio', 'alto']).nullish().or(z.literal('').transform(() => null)),
  promocion:        z.object({
    activo:        z.boolean(),
    fecha_inicio:  z.string().nullish(),
    fecha_fin:     z.string().nullish(),
    precio_oferta: numOpt,
    auto_renovar:  z.boolean().nullish(),
  }).nullish(),
  imagenes:         z.array(z.string()).nullish(),
  imagen_url:       strOpt,
  video_url:        strOpt,
  categoria_id:     uuidOpt,
  linea_id:         uuidOpt,
  modelo_id:        uuidOpt,
});
export type ProductoInput = z.infer<typeof ProductoSchema>;
