import { useSyncExternalStore } from 'react';
import {
  Phone, MessageCircle, Package, Zap, ShoppingBag, Cake, RefreshCw, Ruler, Target, Mail, StickyNote,
  FilePenLine, ShoppingCart, Factory, Wallet, Wrench, UserRound, CircleDot, Users,
  type LucideIcon,
} from 'lucide-react';
import { TZ_AR } from '@/lib/utils';

// Agenda: tipos y presentación compartidos por el aviso del día (AgendaDelDia), la pantalla
// /agenda y el Centro de alertas del Dashboard.

export interface TareaAgenda {
  id: string;
  descripcion: string;
  tipo_accion: string | null;
  hora: string | null;
  prioridad: 'alta' | 'normal' | 'baja';
  vencimiento: string | null;
  ambito: 'cliente' | 'interna';
  categoria: Categoria | null;
  notas: string | null;
  repetir: 'semanal' | 'mensual' | 'dias' | null;
  repetir_cada_dias: number | null;
  completada: boolean;
  completada_at: string | null;
  cliente_id: string | null;
  operacion_id: string | null;
  proveedor_id: string | null;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string | null;
  telefono: string | null;
  proveedor_nombre: string | null;
  proveedor_telefono: string | null;
  operacion_numero: string | null;
  operacion_estado: string | null;
  oportunidad_id: string | null;
  remito_id: string | null;
  remito_numero: string | null;
  visita_id: string | null;
  visita_numero: string | null;
  creada_por: string | null;
  completada_por: string | null;
  // Solo en GET /agenda/hoy
  mostrar_desde?: string | null;
  atrasada?: boolean;
  debe_mostrarse?: boolean;
}

export type Categoria = 'compras' | 'proveedores' | 'pagos' | 'mantenimiento' | 'personal' | 'otro';

interface Meta { label: string; icon: LucideIcon; color: string; bg: string }

export const TIPO_META: Record<string, Meta> = {
  llamada:     { label: 'Llamar',          icon: Phone,         color: 'text-sky-600',     bg: 'bg-sky-100' },
  whatsapp:    { label: 'WhatsApp',        icon: MessageCircle, color: 'text-green-600',   bg: 'bg-green-100' },
  email:       { label: 'Email',           icon: Mail,          color: 'text-blue-600',    bg: 'bg-blue-100' },
  visita:      { label: 'Visita',          icon: Ruler,         color: 'text-indigo-600',  bg: 'bg-indigo-100' },
  entrega:     { label: 'Entrega',         icon: Package,       color: 'text-violet-600',  bg: 'bg-violet-100' },
  instalacion: { label: 'Instalación',     icon: Zap,           color: 'text-amber-600',   bg: 'bg-amber-100' },
  cobranza:    { label: 'Cobranza',        icon: ShoppingBag,   color: 'text-rose-600',    bg: 'bg-rose-100' },
  cumpleanos:  { label: 'Cumpleaños',      icon: Cake,          color: 'text-pink-600',    bg: 'bg-pink-100' },
  seguimiento: { label: 'Seguimiento',     icon: RefreshCw,     color: 'text-gray-600',    bg: 'bg-gray-100' },
  oportunidad: { label: 'Oportunidad',     icon: Target,        color: 'text-fuchsia-600', bg: 'bg-fuchsia-100' },
  recotizar:   { label: 'Recotizar',       icon: FilePenLine,   color: 'text-orange-600',  bg: 'bg-orange-100' },
  nota:        { label: 'Tarea',           icon: StickyNote,    color: 'text-gray-600',    bg: 'bg-gray-100' },
};

export const CATEGORIAS: Record<Categoria, Meta> = {
  compras:       { label: 'Compras e insumos',      icon: ShoppingCart, color: 'text-lime-700',    bg: 'bg-lime-100' },
  proveedores:   { label: 'Proveedores',            icon: Factory,      color: 'text-amber-700',   bg: 'bg-amber-100' },
  pagos:         { label: 'Pagos y administración', icon: Wallet,       color: 'text-emerald-700', bg: 'bg-emerald-100' },
  mantenimiento: { label: 'Mantenimiento',          icon: Wrench,       color: 'text-slate-700',   bg: 'bg-slate-200' },
  personal:      { label: 'Personal',               icon: UserRound,    color: 'text-cyan-700',    bg: 'bg-cyan-100' },
  otro:          { label: 'Otro',                   icon: CircleDot,    color: 'text-gray-600',    bg: 'bg-gray-100' },
};

/** Ícono y etiqueta de una tarea: la categoría si es interna, el tipo de acción si es de cliente. */
export function metaDe(t: Pick<TareaAgenda, 'ambito' | 'categoria' | 'tipo_accion'>): Meta {
  if (t.ambito === 'interna') return CATEGORIAS[t.categoria ?? 'otro'] ?? CATEGORIAS.otro;
  return TIPO_META[t.tipo_accion ?? 'nota'] ?? { label: 'Tarea', icon: Users, color: 'text-gray-600', bg: 'bg-gray-100' };
}

export function nombreClienteDe(t: Pick<TareaAgenda, 'tipo_persona' | 'razon_social' | 'apellido' | 'nombre'>): string {
  if (t.tipo_persona === 'juridica') return t.razon_social ?? '—';
  return [t.apellido, t.nombre].filter(Boolean).join(' ') || '—';
}

/** A quién se refiere: el cliente, el proveedor o "Empresa" para las internas sin proveedor. */
export function sujetoDe(t: TareaAgenda): string {
  if (t.ambito === 'interna') return t.proveedor_nombre ?? CATEGORIAS[t.categoria ?? 'otro']?.label ?? 'Empresa';
  return nombreClienteDe(t);
}

export function telefonoDe(t: TareaAgenda): string | null {
  return (t.ambito === 'interna' ? t.proveedor_telefono : t.telefono) || null;
}

/** Adónde lleva "Ir": la proforma a recotizar en edición, la visita, el remito, el proveedor o el cliente. */
export function destinoDe(t: TareaAgenda): string | null {
  if (t.tipo_accion === 'recotizar' && t.operacion_id) return `/presupuestos/${t.operacion_id}/editar`;
  if (t.visita_id) return `/presupuestos/visitas-tecnicas/${t.visita_id}`;
  if (t.remito_id && t.remito_numero) return `/remitos?q=${encodeURIComponent(t.remito_numero)}`;
  if (t.ambito === 'interna') return t.proveedor_nombre ? `/proveedores?q=${encodeURIComponent(t.proveedor_nombre)}` : null;
  if (t.operacion_id && t.tipo_accion !== 'oportunidad') return `/presupuestos?id=${t.operacion_id}`;
  return t.cliente_id ? `/clientes/${t.cliente_id}` : null;
}

export const horaCorta = (h: string | null | undefined) => (h ? h.slice(0, 5) : '');

/** "12:30" o "mañana 09:00" para la etiqueta "te recuerdo …". */
export function cuandoRecuerda(iso: string, hoy: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('en-CA', { timeZone: TZ_AR });
  const hora = d.toLocaleTimeString('es-AR', { timeZone: TZ_AR, hour: '2-digit', minute: '2-digit', hour12: false });
  return dia === hoy ? hora : dia > hoy ? `mañana ${hora}` : hora;
}

/** "lun 29/09" para una fecha YYYY-MM-DD. */
export function fechaCorta(f: string | null): string {
  if (!f) return 'Sin fecha';
  const d = new Date(`${f}T12:00:00`);
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** YYYY-MM-DD de hoy + n días, en horario Argentina. */
export function diaAR(n = 0): string {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: TZ_AR });
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Coordinación entre el aviso y el resto de la pantalla ───────
// Mientras el aviso del día está abierto, AvisosEmergentes espera (no se apila todo encima).
let avisoAbierto = false;
const oyentes = new Set<() => void>();
export function setAvisoAgendaAbierto(v: boolean) {
  if (avisoAbierto === v) return;
  avisoAbierto = v;
  oyentes.forEach(f => f());
}
export function useAvisoAgendaAbierto(): boolean {
  return useSyncExternalStore(
    f => { oyentes.add(f); return () => oyentes.delete(f); },
    () => avisoAbierto,
  );
}

/** Avisa a las otras partes de la app (y a las otras pestañas) que la agenda cambió. */
export const EVENTO_AGENDA = 'agenda:cambio';
export function avisarCambioAgenda() {
  window.dispatchEvent(new Event(EVENTO_AGENDA));
}

// Botón de la agenda en la barra superior: AgendaDelDia publica cuántas hay y cómo abrir el
// aviso; el botón (en el header) solo lo lee. Va arriba y no flotando abajo porque abajo
// tapaba los botones de los modales en el celular.
export interface EstadoBotonAgenda { total: number; atrasadas: number; abrir: (() => void) | null }
let botonAgenda: EstadoBotonAgenda = { total: 0, atrasadas: 0, abrir: null };
const oyentesBoton = new Set<() => void>();
export function setBotonAgenda(b: EstadoBotonAgenda) {
  if (b.total === botonAgenda.total && b.atrasadas === botonAgenda.atrasadas && b.abrir === botonAgenda.abrir) return;
  botonAgenda = b;
  oyentesBoton.forEach(f => f());
}
export function useBotonAgenda(): EstadoBotonAgenda {
  return useSyncExternalStore(
    f => { oyentesBoton.add(f); return () => oyentesBoton.delete(f); },
    () => botonAgenda,
  );
}
