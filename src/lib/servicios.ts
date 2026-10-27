// Garantías y servicios técnicos (Post venta): tipos y etiquetas compartidos por la lista, la ficha y los formularios.

export type TipoServicio = 'garantia' | 'reparacion' | 'mantenimiento';
export type EstadoServicio = 'pendiente_coordinar' | 'visita_programada' | 'en_proceso' | 'pendiente_repuesto' | 'finalizado' | 'cancelado';
export type TrabajoTipo = 'ajuste' | 'reparacion' | 'cambio_pieza' | 'reemplazo_completo' | 'otro';

export interface Intervencion {
  id: string; orden: number; fecha: string; tecnico_id: string | null; tecnico_nombre: string | null; tecnico: string | null;
  problema_encontrado: string | null; trabajo_tipo: TrabajoTipo; trabajo_detalle: string;
  materiales: { descripcion: string; cantidad: number }[]; fotos_antes: string[]; fotos_despues: string[];
  observaciones: string | null; pendientes: string | null; con_cargo: boolean;
  resultado: 'resuelto' | 'nueva_visita' | 'pendiente_repuesto';
  firma_url: string | null; recibio_nombre: string | null; recibio_dni: string | null;
  conformidad: 'conforme' | 'con_observaciones' | null; conformidad_obs: string | null; sin_firma_motivo: string | null;
  firmada_at: string | null; enviada_whatsapp_at: string | null; created_at: string;
}

export interface ServicioFila {
  id: string; numero: string; tipo: TipoServicio; estado: EstadoServicio; origen: string; problema: string;
  producto_descripcion: string | null; adjuntos: string[];
  fecha_reclamo: string; fecha_visita: string | null; hora_visita: string | null;
  cliente_id: string; operacion_id: string | null; remito_id: string | null;
  responsable_id: string | null; responsable_nombre: string | null; responsable: string | null;
  recontacto_fecha: string | null; recontacto_resultado: 'funciona' | 'sigue_con_problemas' | null;
  finalizado_at: string | null; created_at: string; updated_at: string;
  cliente_nombre: string | null; cliente_telefono: string | null; cliente_direccion: string | null; cliente_localidad: string | null;
  operacion_numero: string | null; remito_numero: string | null; intervenciones: number;
}

export interface ServicioDetalle extends ServicioFila {
  remito_item_id: string | null; operacion_item_id: string | null; producto_id: string | null;
  postventa_seguimiento_id: string | null; motivo_cancelacion: string | null; recontacto_at: string | null;
  tarea_id: string | null; creado_por: string | null;
  intervenciones_lista?: never;
  otros_servicios: { id: string; numero: string; tipo: TipoServicio; estado: EstadoServicio; fecha_reclamo: string; problema: string }[];
  recibos: { id: string; numero: string; monto_total: string; forma_pago: string; estado: string; fecha: string }[];
  presupuestos: { id: string; numero: string; estado: string; precio_total: string }[];
  reclamos: {
    clase: 'incidencia' | 'solicitud'; id: string; numero: string; estado: string; tipo: string | null; descripcion: string | null;
    solucion: string | null; respuesta_proveedor: string | null; created_at: string;
    pedido_id: string | null; pedido_numero: string | null; proveedor: string | null;
  }[];
}
export type ServicioConIntervenciones = Omit<ServicioDetalle, 'intervenciones'> & { intervenciones: Intervencion[] };

export const TIPO_SERVICIO: Record<TipoServicio, { label: string; corto: string; cls: string }> = {
  garantia:      { label: 'Garantía',             corto: 'Garantía',      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  reparacion:    { label: 'Reparación con cargo', corto: 'Reparación',    cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  mantenimiento: { label: 'Mantenimiento',        corto: 'Mantenimiento', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
};

export const ESTADO_SERVICIO: Record<EstadoServicio, { label: string; solido: string }> = {
  pendiente_coordinar: { label: 'Pendiente de coordinar', solido: 'bg-amber-600' },
  visita_programada:   { label: 'Visita programada',      solido: 'bg-sky-600' },
  en_proceso:          { label: 'En proceso',             solido: 'bg-violet-600' },
  pendiente_repuesto:  { label: 'Repuesto o nueva visita', solido: 'bg-orange-600' },
  finalizado:          { label: 'Finalizado',             solido: 'bg-emerald-600' },
  cancelado:           { label: 'Cancelado',              solido: 'bg-gray-500' },
};

export const TRABAJO_TIPO: Record<TrabajoTipo, string> = {
  ajuste: 'Ajuste', reparacion: 'Reparación', cambio_pieza: 'Cambio de pieza', reemplazo_completo: 'Reemplazo completo', otro: 'Otro',
};

export const ENDPOINT_ADJUNTOS_SERVICIO = '/api/servicios-tecnicos/adjuntos';
export const ACCEPT_ADJUNTOS_SERVICIO = 'image/*,video/*,application/pdf';

export const fechaCortaServicio = (iso: string | null) =>
  iso ? new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

/** Meses entre la entrega y hoy, para sugerir garantía. */
export function mesesDesde(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  const h = new Date();
  return (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth()) - (h.getDate() < d.getDate() ? 1 : 0);
}
