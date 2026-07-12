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

export const ReciboSchema = z.object({
  cliente_id:      zUUID,
  operacion_id:    zUUID.optional().nullable(),
  remito_id:       zUUID.optional().nullable(),
  monto_total:     z.number().positive('Monto debe ser > 0'),
  forma_pago:      z.enum(['Contado','Tarjeta de débito/crédito en 1 pago','Transferencia','Tarjeta de crédito 3 cuotas sin interés']),
  fecha:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referencia_pago: zText(200).optional(),
  concepto:        zText(500).optional(),
  notas:           zText(1000).optional(),
  items:           z.array(ReciboItemSchema).optional().default([]),
  compromiso:      ReciboCompromisoSchema,
  descuento_pct:   z.number().min(0).max(100).optional().default(0),
  monto_lista:     z.number().min(0).optional().default(0),
  monto_descuento: z.number().min(0).optional().default(0),
  comprobante_url: zText(300).optional().nullable(),
});

// ── Pedidos al proveedor ───────────────────────────────────────
const PedidoItemSchema = z.object({
  operacion_item_id: zUUID.optional().nullable(),
  producto_id:       zUUID.optional().nullable(),
  descripcion:       z.string().min(1).max(500),
  cantidad:          z.number().int().positive(),
  costo_unitario:    zPosNum,
  orden:             z.number().int().optional(),
});

export const PedidoSchema = z.object({
  proveedor_id:      zUUID,
  operacion_id:      zUUID.optional().nullable(),
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

export const ProveedorSchema = z.object({
  nombre:             z.string().min(1, 'Nombre requerido').max(200),
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
  costo_flete:        z.number().min(0).max(100).optional().nullable().default(0),
  calificacion:       z.number().int().min(1).max(5).optional().nullable(),
  deuda_actual:       zPosNum.optional().nullable().default(0),
  es_principal:       z.boolean().optional().default(false),
  margen_venta:       z.number().min(0).max(100).optional().nullable().default(0),
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
