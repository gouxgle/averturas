export type OportunidadInteres = 'alto' | 'medio' | 'bajo';
export type OportunidadEstado = 'pendiente' | 'contactada' | 'convertida' | 'descartada';
export type OportunidadOrigen = 'cliente' | 'presupuesto' | 'crm' | 'publico';

export interface OportunidadCliente {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: 'fisica' | 'juridica';
  telefono: string | null;
  email: string | null;
}

export interface Oportunidad {
  id: string;
  cliente_id: string;
  operacion_id_origen: string | null;
  operacion_id_ganada: string | null;
  tarea_id: string | null;
  motivo: string;
  fecha_recontacto: string;
  interes: OportunidadInteres;
  probabilidad: number;
  observaciones: string | null;
  estado: OportunidadEstado;
  motivo_cierre: string | null;
  origen: OportunidadOrigen;
  veces_pospuesta: number;
  ultimo_contacto_at: string | null;
  cerrada_at: string | null;
  notif_leida: boolean;
  created_at: string;
  updated_at: string;
  // Solo en el listado (GET /oportunidades)
  dias_atraso?: number;
  operacion_origen_numero?: string | null;
  cliente?: OportunidadCliente;
}

export function nombreClienteOportunidad(c: OportunidadCliente): string {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';
}

export const INTERES_CFG: Record<OportunidadInteres, { label: string; emoji: string; cls: string }> = {
  alto:  { label: 'Alto',  emoji: '🔴', cls: 'bg-red-50 text-red-700 border-red-200' },
  medio: { label: 'Medio', emoji: '🟡', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  bajo:  { label: 'Bajo',  emoji: '🔵', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
};
