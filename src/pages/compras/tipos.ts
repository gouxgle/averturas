// Tipos, etiquetas y helpers del módulo Compras (SC → PC → OC). Ver docs/compras-plan.md.

export interface ClienteMin {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: 'fisica' | 'juridica';
  telefono?: string | null;
}

export interface ProveedorMin {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  contacto: string | null;
  color?: string | null;
}

export type OrigenCompra =
  | 'venta' | 'proforma' | 'orden_trabajo' | 'reposicion_stock'
  | 'produccion_propia' | 'faltante' | 'garantia' | 'reposicion_falla';

export type TipoProductoCompra =
  | 'abertura_estandar' | 'abertura_medida' | 'perfil' | 'vidrio' | 'herraje_accesorio' | 'otro';

export type EstadoSolicitud = 'abierta' | 'en_cotizacion' | 'con_oc' | 'cerrada' | 'cancelada';
export type EstadoItemSolicitud = 'pendiente' | 'en_cotizacion' | 'comprado' | 'cancelado';
export type EstadoCotizacion = 'abierta' | 'adjudicada' | 'no_concretada' | 'cancelada';
export type EstadoCotizacionProveedor = 'pendiente' | 'enviada' | 'respondida' | 'sin_respuesta' | 'seleccionada' | 'descartada';
export type EstadoLogistica =
  | 'borrador' | 'enviada' | 'confirmada' | 'en_preparacion' | 'en_fabricacion' | 'terminado'
  | 'listo_despacho' | 'en_transito' | 'demorado' | 'recibida_parcial' | 'recibida' | 'cerrada' | 'cancelada';
export type EstadoLegacy = 'pendiente' | 'enviado' | 'recibido' | 'cancelado';
export type Disponibilidad = 'inmediata' | 'a_fabricar' | 'parcial' | 'sin_stock';
export type MedioEnvio = 'whatsapp' | 'email' | 'manual';

export type Especificaciones = Record<string, unknown>;

export interface SolicitudItem {
  id: string;
  orden: number;
  operacion_item_id: string | null;
  visita_tecnica_item_id: string | null;
  producto_id: string | null;
  producto_nombre?: string | null;
  producto_imagen_url?: string | null;
  descripcion: string;
  cantidad: number | string;
  unidad: string;
  especificaciones: Especificaciones;
  adjuntos: string[];
  observaciones: string | null;
  costo_referencia: number | string | null;
  proveedor_sku: string | null;
  estado: EstadoItemSolicitud;
  orden_compra?: { id: string; numero: string; estado_logistica: EstadoLogistica } | null;
  cotizaciones?: { id: string; numero: string; estado: EstadoCotizacion }[];
}

export interface SolicitudRow {
  id: string;
  numero: string;
  origen: OrigenCompra;
  operacion_id: string | null;
  visita_tecnica_id: string | null;
  cliente_id: string | null;
  obra: string | null;
  tipo_producto: TipoProductoCompra;
  fecha_necesaria: string | null;
  observaciones: string | null;
  adjuntos: string[];
  estado: EstadoSolicitud;
  proveedor_sugerido_id: string | null;
  created_at: string;
  cliente: ClienteMin | null;
  operacion: { id: string; numero: string; estado?: string } | null;
  visita_tecnica: { id: string; numero: string } | null;
  proveedor_sugerido: ProveedorMin | null;
  items_count: number;
  items_pendientes: number;
  cotizaciones: { id: string; numero: string; estado: EstadoCotizacion }[];
  ordenes: { id: string; numero: string; estado_logistica: EstadoLogistica }[];
  items_resumen: { descripcion: string; cantidad: number | string }[] | null;
}

export interface SolicitudDetalle extends SolicitudRow {
  items: SolicitudItem[];
}

export interface CotizacionRespuestaItem {
  id: string;
  solicitud_item_id: string;
  precio_unitario_neto: number | string;
  descuento_pct: number | string;
  iva_pct: number | string;
  plazo_dias: number | null;
  disponibilidad: Disponibilidad | null;
  observaciones: string | null;
}

export interface CotizacionProveedor {
  id: string;
  cotizacion_id: string;
  proveedor_id: string;
  proveedor: ProveedorMin;
  enviada_at: string | null;
  enviada_medio: MedioEnvio | null;
  contacto: string | null;
  respondida_at: string | null;
  estado: EstadoCotizacionProveedor;
  subtotal_neto: number | string;
  descuento_monto: number | string;
  iva_pct: number | string;
  iva_monto: number | string;
  flete: number | string;
  total: number | string;
  plazo_dias: number | null;
  disponibilidad: Disponibilidad | null;
  forma_pago: string | null;
  validez_hasta: string | null;
  observaciones: string | null;
  archivo_url: string | null;
  adjuntos: string[];
  items: CotizacionRespuestaItem[];
}

export interface CotizacionRow {
  id: string;
  numero: string;
  solicitud_id: string;
  estado: EstadoCotizacion;
  motivo_cierre: string | null;
  fecha_limite: string | null;
  observaciones: string | null;
  created_at: string;
  solicitud: {
    id: string; numero: string; origen: OrigenCompra; obra: string | null; fecha_necesaria: string | null;
    tipo_producto: TipoProductoCompra; cliente: ClienteMin | null; operacion: { id: string; numero: string } | null;
  };
  proveedores_count: number;
  respondidas_count: number;
  esperando_count: number;
  items_count: number;
  proveedores_resumen: { id: string; nombre: string; color: string | null; estado: EstadoCotizacionProveedor; total: number | string }[] | null;
  orden_compra: { id: string; numero: string } | null;
}

export interface CotizacionDetalle extends CotizacionRow {
  items: (SolicitudItem & { cantidad_cotizada: number | string })[];
  proveedores: CotizacionProveedor[];
}

export interface ComparativaFila {
  cotizacion_proveedor_id: string;
  proveedor: ProveedorMin;
  estado: EstadoCotizacionProveedor;
  total: number; subtotal_neto: number; descuento_monto: number; iva_monto: number; flete: number;
  plazo_dias: number | null; disponibilidad: Disponibilidad | null; forma_pago: string | null; validez_hasta: string | null;
  observaciones: string | null; archivo_url: string | null;
  precio_unitario_promedio: number | null;
  con_precios_por_item: boolean;
  items: CotizacionRespuestaItem[];
}

export interface Comparativa {
  cotizacion: { id: string; numero: string; estado: EstadoCotizacion; items: CotizacionDetalle['items'] };
  proveedores: ComparativaFila[];
  mejor: { total: string | null; neto: string | null; flete: string | null; plazo: string | null; validez: string | null };
  pendientes: ProveedorMin[];
}

export interface OrdenItem {
  id: string;
  operacion_item_id: string | null;
  producto_id: string | null;
  producto: { id: string; nombre: string; codigo?: string | null } | null;
  producto_imagen_url: string | null;
  descripcion: string;
  cantidad: number | string;
  unidad: string;
  costo_unitario: number | string;
  precio_unitario_neto: number | string;
  descuento_pct: number | string;
  iva_pct: number | string;
  especificaciones: Especificaciones;
  proveedor_sku: string | null;
  es_reposicion: boolean;
  es_reposicion_reclamo: boolean;
  solicitud_item_id: string | null;
  solicitud_id: string | null;
  solicitud_numero: string | null;
  obra: string | null;
  operacion_numero: string | null;
  cliente: ClienteMin | null;
  cantidad_recibida: number | string;
  estado_item: 'pendiente' | 'parcial' | 'recibido' | 'cancelado';
  neto_linea: number;
  iva_linea: number;
  flete_prorrateado: number;
}

export interface OrdenRow {
  id: string;
  numero: string;
  estado: EstadoLegacy;
  estado_logistica: EstadoLogistica;
  estado_calidad: 'sin_reclamos' | 'reclamo_pendiente' | 'resuelto';
  estado_finanzas: 'sin_factura' | 'pendiente' | 'pago_parcial' | 'pagada' | 'con_credito';
  estado_docs: 'incompleta' | 'completa';
  fecha_pedido: string;
  fecha_entrega_est: string | null;
  fecha_prometida: string | null;
  fecha_recepcion: string | null;
  enviada_at: string | null;
  enviada_medio: MedioEnvio | null;
  monto_total: number | string;
  subtotal_neto: number | string;
  descuento_monto: number | string;
  iva_monto: number | string;
  total: number | string;
  costo_envio: number | string;
  forma_pago: string | null;
  contacto_proveedor: string | null;
  notas: string | null;
  adjuntos: string[];
  transportista_id: string | null;
  transportista_nombre: string | null;
  operacion_id: string | null;
  es_stock_propio: boolean;
  es_consolidada: boolean;
  proveedor: ProveedorMin;
  operacion: { id: string; numero: string; tipo?: string; precio_total?: number; cliente: ClienteMin } | null;
  solicitud: { id: string; numero: string; origen: OrigenCompra; obra: string | null } | null;
  cotizacion: { id: string; numero: string } | null;
  origenes: { solicitud_id: string; solicitud_numero: string; obra: string | null; cliente: ClienteMin | null; operacion_numero: string | null }[];
  items_resumen: { descripcion: string; cantidad: number | string }[] | null;
  items_total_op: number | null;
  items_cubiertos: number | null;
  demorada: boolean;
  dias_demora: number;
}

export interface OrdenDetalle extends OrdenRow {
  items: OrdenItem[];
}

// ── Etapa 2: seguimiento, recepciones, reclamos ───────────────────────────────

export type TipoSeguimiento = 'envio' | 'confirmacion' | 'estado' | 'seguimiento' | 'demora' | 'nota' | 'recepcion' | 'reclamo';

export interface Seguimiento {
  id: string;
  pedido_id: string;
  fecha: string;
  tipo: TipoSeguimiento;
  estado_logistica_nuevo: EstadoLogistica | null;
  respuesta_proveedor: string | null;
  nueva_fecha_prometida: string | null;
  observaciones: string | null;
  usuario_nombre: string | null;
  created_at: string;
}

export interface RecepcionItem {
  id: string;
  pedido_item_id: string;
  descripcion: string;
  unidad: string;
  cantidad_pedida: number | string;
  cantidad_recibida: number | string;
  cantidad_conforme: number | string;
  cantidad_problema: number | string;
  no_recibido: boolean;
  observaciones: string | null;
  incidencia: { id: string; numero: string; estado: EstadoIncidencia } | null;
}

export interface Recepcion {
  id: string;
  pedido_id: string;
  numero_secuencia: number;
  fecha: string;
  remito_proveedor_nro: string | null;
  transportista_id: string | null;
  transportista_nombre: string | null;
  costo_envio_real: number | string | null;
  adjuntos: string[];
  notas: string | null;
  usuario_nombre: string | null;
  created_at: string;
  items: RecepcionItem[];
}

export type EstadoIncidencia = 'abierta' | 'reclamada' | 'respondida' | 'en_reposicion' | 'resuelta' | 'rechazada';
export type TipoIncidencia =
  | 'producto_faltante' | 'medida_incorrecta' | 'color_incorrecto' | 'vidrio_roto' | 'vidrio_rayado'
  | 'perfil_golpeado' | 'perfil_rayado' | 'herraje_faltante' | 'herraje_incorrecto'
  | 'producto_incompleto' | 'error_fabricacion' | 'otro';
export type SolucionIncidencia =
  | 'reposicion_total' | 'reposicion_parcial' | 'cambio_vidrio' | 'envio_herraje' | 'reparacion'
  | 'descuento' | 'nota_credito' | 'devolucion' | 'rechazado';

export interface Incidencia {
  id: string;
  numero: string;
  pedido_id: string;
  pedido_item_id: string;
  recepcion_item_id: string | null;
  tipo: TipoIncidencia;
  cantidad_afectada: number | string;
  descripcion: string | null;
  adjuntos: string[];
  estado: EstadoIncidencia;
  reclamada_at: string | null;
  reclamada_medio: MedioEnvio | null;
  respuesta_proveedor: string | null;
  respondida_at: string | null;
  solucion: SolucionIncidencia | null;
  solucion_detalle: string | null;
  monto_descuento: number | string | null;
  reposicion_pedido_item_id: string | null;
  resuelta_at: string | null;
  created_at: string;
  item_descripcion: string;
  item_unidad: string;
  item_cantidad: number | string;
  item_especificaciones: Especificaciones | null;
  orden: { id: string; numero: string; estado_logistica: EstadoLogistica; fecha_pedido: string };
  proveedor: ProveedorMin;
  operacion: { id: string; numero: string; cliente: ClienteMin } | null;
  reposicion: { id: string; descripcion: string; cantidad: number | string; estado_item: string; cantidad_conforme: number | string } | null;
  usuario_nombre: string | null;
}

export interface TableroCompras {
  stats: {
    sc_abiertas: number; pc_abiertas: number; pc_esperando: number; oc_en_curso: number; oc_borrador: number;
    oc_demoradas: number; oc_activas: number; valor_en_curso: number;
    oc_por_recibir: number; reclamos_abiertos: number; reclamos_sin_reclamar: number;
  };
  esperando_recepcion: { id: string; numero: string; fecha_prometida: string | null; fecha_entrega_est: string | null; estado_logistica: EstadoLogistica; proveedor: { nombre: string; telefono: string | null }; operacion: { numero: string; cliente: ClienteMin } | null }[];
  para_preparar: { id: string; numero: string; fecha_recepcion: string | null; proveedor: { nombre: string }; operacion: { id: string; numero: string; cliente: ClienteMin } | null }[];
}

// ── Etiquetas ─────────────────────────────────────────────────────────────────

export const ORIGEN_LABEL: Record<OrigenCompra, string> = {
  venta:             'Venta',
  proforma:          'Proforma',
  orden_trabajo:     'Orden de trabajo',
  reposicion_stock:  'Reposición de stock',
  produccion_propia: 'Producción propia',
  faltante:          'Faltante',
  garantia:          'Garantía',
  reposicion_falla:  'Reposición por falla',
};

export const TIPO_PRODUCTO_LABEL: Record<TipoProductoCompra, string> = {
  abertura_estandar: 'Abertura estándar',
  abertura_medida:   'Abertura a medida',
  perfil:            'Perfiles',
  vidrio:            'Vidrios',
  herraje_accesorio: 'Herrajes / accesorios',
  otro:              'Otro',
};

export const ESTADO_SC: Record<EstadoSolicitud, { label: string; cls: string }> = {
  abierta:       { label: 'Abierta',        cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  en_cotizacion: { label: 'En cotización',  cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  con_oc:        { label: 'Con orden',      cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cerrada:       { label: 'Cerrada',        cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelada:     { label: 'Cancelada',      cls: 'bg-red-100 text-red-700 border-red-200' },
};

export const ESTADO_ITEM_SC: Record<EstadoItemSolicitud, { label: string; cls: string }> = {
  pendiente:     { label: 'Pendiente',     cls: 'bg-amber-100 text-amber-800' },
  en_cotizacion: { label: 'En cotización', cls: 'bg-sky-100 text-sky-800' },
  comprado:      { label: 'Comprado',      cls: 'bg-emerald-100 text-emerald-800' },
  cancelado:     { label: 'Cancelado',     cls: 'bg-gray-100 text-gray-600' },
};

export const ESTADO_PC: Record<EstadoCotizacion, { label: string; cls: string }> = {
  abierta:       { label: 'Abierta',        cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  adjudicada:    { label: 'Adjudicada',     cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  no_concretada: { label: 'No concretada',  cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  cancelada:     { label: 'Cancelada',      cls: 'bg-red-100 text-red-700 border-red-200' },
};

export const ESTADO_PC_PROV: Record<EstadoCotizacionProveedor, { label: string; cls: string }> = {
  pendiente:     { label: 'Sin enviar',     cls: 'bg-gray-100 text-gray-700' },
  enviada:       { label: 'Esperando respuesta', cls: 'bg-sky-100 text-sky-800' },
  respondida:    { label: 'Respondió',      cls: 'bg-emerald-100 text-emerald-800' },
  sin_respuesta: { label: 'Sin respuesta',  cls: 'bg-amber-100 text-amber-800' },
  seleccionada:  { label: 'Elegido',        cls: 'bg-emerald-600 text-white' },
  descartada:    { label: 'Descartado',     cls: 'bg-gray-100 text-gray-500' },
};

export const ESTADO_LOGISTICA: Record<EstadoLogistica, { label: string; cls: string; border: string }> = {
  borrador:         { label: 'Borrador',            cls: 'bg-amber-100 text-amber-800 border-amber-200',     border: 'border-l-amber-400' },
  enviada:          { label: 'Enviada al proveedor', cls: 'bg-sky-100 text-sky-800 border-sky-200',          border: 'border-l-sky-400' },
  confirmada:       { label: 'Confirmada',          cls: 'bg-sky-100 text-sky-800 border-sky-200',           border: 'border-l-sky-500' },
  en_preparacion:   { label: 'En preparación',      cls: 'bg-indigo-100 text-indigo-800 border-indigo-200',  border: 'border-l-indigo-400' },
  en_fabricacion:   { label: 'En fabricación',      cls: 'bg-indigo-100 text-indigo-800 border-indigo-200',  border: 'border-l-indigo-400' },
  terminado:        { label: 'Terminado',           cls: 'bg-violet-100 text-violet-800 border-violet-200',  border: 'border-l-violet-400' },
  listo_despacho:   { label: 'Listo p/ despacho',   cls: 'bg-violet-100 text-violet-800 border-violet-200',  border: 'border-l-violet-400' },
  en_transito:      { label: 'En tránsito',         cls: 'bg-teal-100 text-teal-800 border-teal-200',        border: 'border-l-teal-400' },
  demorado:         { label: 'Demorado',            cls: 'bg-red-100 text-red-700 border-red-200',           border: 'border-l-red-500' },
  recibida_parcial: { label: 'Recibida parcial',    cls: 'bg-lime-100 text-lime-800 border-lime-200',        border: 'border-l-lime-500' },
  recibida:         { label: 'Recibida',            cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', border: 'border-l-emerald-500' },
  cerrada:          { label: 'Cerrada',             cls: 'bg-gray-100 text-gray-700 border-gray-200',        border: 'border-l-gray-400' },
  cancelada:        { label: 'Cancelada',           cls: 'bg-gray-100 text-gray-600 border-gray-200',        border: 'border-l-gray-300' },
};

export const DISPONIBILIDAD_LABEL: Record<Disponibilidad, string> = {
  inmediata:  'Entrega inmediata',
  a_fabricar: 'A fabricar',
  parcial:    'Parcial',
  sin_stock:  'Sin stock',
};

export const ESTADO_INCIDENCIA: Record<EstadoIncidencia, { label: string; cls: string; border: string }> = {
  abierta:       { label: 'Sin reclamar',   cls: 'bg-red-100 text-red-700 border-red-200',           border: 'border-l-red-500' },
  reclamada:     { label: 'Reclamado',      cls: 'bg-amber-100 text-amber-800 border-amber-200',     border: 'border-l-amber-500' },
  respondida:    { label: 'Respondió',      cls: 'bg-sky-100 text-sky-800 border-sky-200',           border: 'border-l-sky-500' },
  en_reposicion: { label: 'En reposición',  cls: 'bg-indigo-100 text-indigo-800 border-indigo-200',  border: 'border-l-indigo-500' },
  resuelta:      { label: 'Resuelto',       cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', border: 'border-l-emerald-500' },
  rechazada:     { label: 'Rechazado',      cls: 'bg-gray-100 text-gray-700 border-gray-200',        border: 'border-l-gray-400' },
};

export const TIPO_INCIDENCIA_LABEL: Record<TipoIncidencia, string> = {
  producto_faltante: 'Producto faltante', medida_incorrecta: 'Medida incorrecta',
  color_incorrecto: 'Color incorrecto', vidrio_roto: 'Vidrio roto', vidrio_rayado: 'Vidrio rayado',
  perfil_golpeado: 'Perfil golpeado', perfil_rayado: 'Perfil rayado',
  herraje_faltante: 'Herraje faltante', herraje_incorrecto: 'Herraje incorrecto',
  producto_incompleto: 'Producto incompleto', error_fabricacion: 'Error de fabricación', otro: 'Otro',
};

export const SOLUCION_LABEL: Record<SolucionIncidencia, { label: string; ayuda: string }> = {
  reposicion_total:   { label: 'Repone todo',            ayuda: 'Manda de nuevo la cantidad afectada. Se agrega a la orden como ítem de reposición, sin costo.' },
  reposicion_parcial: { label: 'Repone una parte',       ayuda: 'Manda parte de lo afectado. Se agrega como ítem de reposición, sin costo.' },
  cambio_vidrio:      { label: 'Cambia el vidrio',       ayuda: 'Manda el vidrio de repuesto. Se agrega como ítem de reposición, sin costo.' },
  envio_herraje:      { label: 'Manda el herraje',       ayuda: 'Manda el herraje faltante. Se agrega como ítem de reposición, sin costo.' },
  reparacion:         { label: 'Lo repara acá',          ayuda: 'Se arregla en el taller o en la obra: el reclamo queda resuelto, sin mercadería en camino.' },
  descuento:          { label: 'Hace un descuento',      ayuda: 'Descuenta el importe de la factura. El reclamo queda resuelto (el asiento en la cuenta corriente llega en la próxima etapa).' },
  nota_credito:       { label: 'Emite nota de crédito',  ayuda: 'Emite una nota de crédito por el importe. El reclamo queda resuelto.' },
  devolucion:         { label: 'Devolvemos la mercadería', ayuda: 'Se le devuelve lo afectado. El reclamo queda resuelto.' },
  rechazado:          { label: 'No se hace cargo',       ayuda: 'El proveedor rechaza el reclamo: queda cerrado como rechazado.' },
};

/** Etapas visibles de la línea de tiempo de una OC (las excepciones no entran). */
export const TIMELINE_LOGISTICA: EstadoLogistica[] = [
  'borrador', 'enviada', 'confirmada', 'en_fabricacion', 'listo_despacho', 'en_transito', 'recibida',
];

/** Próximo paso sugerido según el estado actual (botón contextual del detalle). */
export const SIGUIENTE_LOGISTICA: Partial<Record<EstadoLogistica, { estado: EstadoLogistica; label: string }>> = {
  enviada:        { estado: 'confirmada',     label: 'Registrar confirmación' },
  confirmada:     { estado: 'en_fabricacion', label: 'Marcar en fabricación' },
  en_preparacion: { estado: 'listo_despacho', label: 'Marcar listo para despacho' },
  en_fabricacion: { estado: 'terminado',      label: 'Marcar terminado' },
  terminado:      { estado: 'listo_despacho', label: 'Marcar listo para despacho' },
  listo_despacho: { estado: 'en_transito',    label: 'Marcar en camino' },
  demorado:       { estado: 'en_transito',    label: 'Marcar en camino' },
};

export const UNIDAD_LABEL: Record<string, string> = { u: 'u', m: 'm', m2: 'm²', kg: 'kg' };

export const IVA_OPCIONES = [0, 10.5, 21, 27];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtMoneda(n: number | string | null | undefined, decimales = 0) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: decimales, minimumFractionDigits: decimales }).format(Number(n ?? 0));
}

export function fmtFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtCantidad(n: number | string, unidad = 'u') {
  const v = Number(n);
  const s = Number.isInteger(v) ? String(v) : v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidad && unidad !== 'u' ? `${s} ${UNIDAD_LABEL[unidad] ?? unidad}` : s;
}

export function nombreCliente(c: ClienteMin | null | undefined) {
  if (!c) return '—';
  return c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '—')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim() || '—';
}

export function haceCuanto(iso: string | null | undefined) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'hace minutos';
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

const hum = (v: unknown) => String(v).replace(/_/g, ' ');

/** Ficha técnica en una línea ("1,20 × 1,50 m · Blanco · DVH"). Mismo criterio que el backend. */
export function resumenEspecificaciones(e: Especificaciones | null | undefined): string {
  if (!e) return '';
  const partes: string[] = [];
  const num = (v: unknown) => Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (e.ancho_m && e.alto_m) partes.push(`${num(e.ancho_m)} × ${num(e.alto_m)} m`);
  if (e.largo_mm) partes.push(`${e.largo_mm} mm`);
  if (e.ancho_mm && e.alto_mm) partes.push(`${e.ancho_mm} × ${e.alto_mm} mm`);
  if (e.espesor_mm) partes.push(`${e.espesor_mm} mm`);
  for (const k of ['tipo_abertura', 'sistema', 'color', 'vidrio', 'apertura', 'hojas', 'tipo', 'marca', 'codigo']) {
    if (typeof e[k] === 'string' && e[k]) partes.push(hum(e[k]));
  }
  if (e.mosquitero === true) partes.push('con mosquitero');
  if (e.premarco === true) partes.push('con premarco');
  if (typeof e.herrajes === 'string' && e.herrajes) partes.push(`herrajes: ${hum(e.herrajes)}`);
  if (Array.isArray(e.accesorios) && e.accesorios.length) partes.push((e.accesorios as string[]).join(', '));
  return partes.join(' · ');
}

/** Campos de la ficha técnica por tipo de producto (formulario de la SC). */
export const CAMPOS_ESPEC: Record<TipoProductoCompra, { key: string; label: string; tipo: 'num' | 'text' | 'bool'; sufijo?: string }[]> = {
  abertura_estandar: [
    { key: 'ancho_m', label: 'Ancho', tipo: 'num', sufijo: 'm' }, { key: 'alto_m', label: 'Alto', tipo: 'num', sufijo: 'm' },
    { key: 'sistema', label: 'Sistema', tipo: 'text' }, { key: 'color', label: 'Color', tipo: 'text' },
    { key: 'vidrio', label: 'Vidrio', tipo: 'text' }, { key: 'apertura', label: 'Apertura', tipo: 'text' },
    { key: 'herrajes', label: 'Herrajes', tipo: 'text' }, { key: 'mosquitero', label: 'Mosquitero', tipo: 'bool' },
    { key: 'premarco', label: 'Premarco', tipo: 'bool' },
  ],
  abertura_medida: [
    { key: 'ancho_m', label: 'Ancho', tipo: 'num', sufijo: 'm' }, { key: 'alto_m', label: 'Alto', tipo: 'num', sufijo: 'm' },
    { key: 'tipo_abertura', label: 'Tipo de abertura', tipo: 'text' }, { key: 'sistema', label: 'Sistema', tipo: 'text' },
    { key: 'color', label: 'Color', tipo: 'text' }, { key: 'vidrio', label: 'Vidrio', tipo: 'text' },
    { key: 'apertura', label: 'Apertura', tipo: 'text' }, { key: 'herrajes', label: 'Herrajes', tipo: 'text' },
    { key: 'mosquitero', label: 'Mosquitero', tipo: 'bool' }, { key: 'premarco', label: 'Premarco', tipo: 'bool' },
  ],
  perfil: [
    { key: 'codigo', label: 'Código', tipo: 'text' }, { key: 'color', label: 'Color', tipo: 'text' },
    { key: 'largo_mm', label: 'Largo', tipo: 'num', sufijo: 'mm' }, { key: 'cantidad_barras', label: 'Barras', tipo: 'num' },
  ],
  vidrio: [
    { key: 'tipo', label: 'Tipo', tipo: 'text' }, { key: 'espesor_mm', label: 'Espesor', tipo: 'num', sufijo: 'mm' },
    { key: 'ancho_mm', label: 'Ancho', tipo: 'num', sufijo: 'mm' }, { key: 'alto_mm', label: 'Alto', tipo: 'num', sufijo: 'mm' },
  ],
  herraje_accesorio: [
    { key: 'codigo', label: 'Código', tipo: 'text' }, { key: 'marca', label: 'Marca', tipo: 'text' },
    { key: 'descripcion', label: 'Detalle', tipo: 'text' },
  ],
  otro: [{ key: 'detalle', label: 'Detalle', tipo: 'text' }],
};

/** Descarga un PDF autenticado y lo abre en una pestaña nueva (el token va por header, no sirve un link directo). */
export async function abrirPdf(path: string) {
  const token = sessionStorage.getItem('aberturas_token');
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Error ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Sube un adjunto (imagen o PDF) al módulo Compras. */
export async function subirAdjunto(file: File): Promise<{ url: string; nombre: string; tipo: 'pdf' | 'imagen' }> {
  const token = sessionStorage.getItem('aberturas_token');
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await fetch('/api/compras/adjuntos', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Error al subir el archivo');
  }
  return res.json();
}

export function esPdf(url: string) { return /\.pdf($|\?)/i.test(url); }

/** Totales de un formulario de precios (misma fórmula que `calcularTotales` del backend). */
export function calcularTotalesForm(lineas: { cantidad: number; precio: number; desc: number; iva: number }[], flete: number) {
  let neto = 0, desc = 0, iva = 0;
  for (const l of lineas) {
    const bruto = l.cantidad * l.precio;
    const d = bruto * l.desc / 100;
    neto += bruto; desc += d; iva += (bruto - d) * l.iva / 100;
  }
  return { neto, desc, iva, flete, total: neto - desc + iva + flete };
}
