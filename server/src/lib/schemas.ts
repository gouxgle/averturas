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
  estado:          z.enum(['pendiente','enviado','recibido','cancelado']),
  fecha_recepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
