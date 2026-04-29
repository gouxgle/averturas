import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, Plus, MessageSquare, PhoneCall,
  Navigation, MessageCircle, Send, FileText, CheckCircle2, AlertTriangle,
  Shield, Building2, User, Hash, Calendar, Clock, Trash2,
  ChevronDown, ClipboardList, TrendingUp, Edit3, Receipt, Truck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Cliente, Operacion, Interaccion, Tarea, TipoInteraccion, EstadoCliente } from '@/types';

// ── Helpers ─────────────────────────────────────────────────
const ESTADO_CLIENTE: Record<EstadoCliente, { label: string; color: string; bg: string }> = {
  prospecto:  { label: 'Prospecto',  color: 'text-gray-600',   bg: 'bg-gray-100' },
  activo:     { label: 'Activo',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  recurrente: { label: 'Recurrente', color: 'text-blue-700',    bg: 'bg-blue-100' },
  inactivo:   { label: 'Inactivo',   color: 'text-amber-700',   bg: 'bg-amber-100' },
  perdido:    { label: 'Perdido',    color: 'text-red-700',     bg: 'bg-red-100' },
};

const ESTADO_OP_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-emerald-100 text-emerald-700',
  cancelado:     'bg-red-100 text-red-700',
};

const ESTADO_OP_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

const TIPO_INTERACCION: Record<TipoInteraccion, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  nota:                  { label: 'Nota',               icon: MessageSquare,  color: 'text-gray-600',   bg: 'bg-gray-100' },
  llamada:               { label: 'Llamada',             icon: PhoneCall,      color: 'text-emerald-600', bg: 'bg-emerald-100' },
  visita:                { label: 'Visita',              icon: Navigation,     color: 'text-blue-600',    bg: 'bg-blue-100' },
  whatsapp:              { label: 'WhatsApp',            icon: MessageCircle,  color: 'text-green-600',   bg: 'bg-green-100' },
  email:                 { label: 'Email',               icon: Send,           color: 'text-sky-600',     bg: 'bg-sky-100' },
  presupuesto_enviado:   { label: 'Presupuesto enviado', icon: FileText,       color: 'text-violet-600',  bg: 'bg-violet-100' },
  operacion_completada:  { label: 'Trabajo completado',  icon: CheckCircle2,   color: 'text-teal-600',    bg: 'bg-teal-100' },
  reclamo:               { label: 'Reclamo',             icon: AlertTriangle,  color: 'text-red-600',     bg: 'bg-red-100' },
  garantia:              { label: 'Garantía',            icon: Shield,         color: 'text-amber-600',   bg: 'bg-amber-100' },
};

const TIPOS_QUICK: TipoInteraccion[] = ['llamada','visita','whatsapp','nota','email','reclamo'];

function nombreMostrado(c: Partial<Cliente>) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function diasColor(dias: number | null) {
  if (dias === null) return 'text-gray-400';
  if (dias <= 7) return 'text-emerald-600';
  if (dias <= 30) return 'text-amber-600';
  return 'text-red-600';
}

// ── Tipos internos ───────────────────────────────────────────
interface ReciboCliente {
  id: string; numero: string; fecha: string;
  monto_total: number; forma_pago: string; estado: string;
  operacion_id: string | null;
  operacion: { id: string; numero: string } | null;
}
interface RemitoCliente {
  id: string; numero: string; fecha_emision: string; estado: string;
  operacion_id: string | null;
  operacion: { id: string; numero: string } | null;
}
interface ClienteConDetalle extends Cliente {
  operaciones: Operacion[];
  interacciones: Interaccion[];
  tareas: Tarea[];
  recibos: ReciboCliente[];
  remitos: RemitoCliente[];
}

// ── Componente principal ─────────────────────────────────────
export function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ClienteConDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  // Interacción rápida
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoInteraccion>('nota');
  const [textoInteraccion, setTextoInteraccion] = useState('');
  const [savingInt, setSavingInt] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Nueva tarea
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState({ descripcion: '', vencimiento: '', prioridad: 'normal' });
  const [savingTarea, setSavingTarea] = useState(false);

  async function load() {
    if (!id) return;
    const result = await api.get<ClienteConDetalle>(`/clientes/${id}`);
    setData(result);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function guardarInteraccion() {
    if (!textoInteraccion.trim() || !id) return;
    setSavingInt(true);
    try {
      await api.post('/interacciones', { cliente_id: id, tipo: tipoSeleccionado, descripcion: textoInteraccion.trim() });
      setTextoInteraccion('');
      await load();
    } catch { toast.error('Error al guardar'); }
    finally { setSavingInt(false); }
  }

  async function eliminarInteraccion(intId: string) {
    await api.delete(`/interacciones/${intId}`);
    await load();
  }

  async function guardarTarea() {
    if (!nuevaTarea.descripcion.trim() || !id) return;
    setSavingTarea(true);
    try {
      await api.post('/tareas', { cliente_id: id, ...nuevaTarea });
      setNuevaTarea({ descripcion: '', vencimiento: '', prioridad: 'normal' });
      setMostrarFormTarea(false);
      await load();
    } catch { toast.error('Error al guardar tarea'); }
    finally { setSavingTarea(false); }
  }

  async function toggleTarea(tareaId: string, completada: boolean) {
    await api.patch(`/tareas/${tareaId}/completar`, { completada });
    await load();
  }

  async function eliminarTarea(tareaId: string) {
    await api.delete(`/tareas/${tareaId}`);
    await load();
  }

  async function handleEliminar() {
    if (!cliente) return;
    const nombre = cliente.tipo_persona === 'juridica'
      ? cliente.razon_social
      : [cliente.apellido, cliente.nombre].filter(Boolean).join(' ');
    if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/clientes/${id}`);
      toast.success('Cliente eliminado');
      navigate('/clientes');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo eliminar');
    }
  }

  // Seleccionar tipo y enfocar textarea
  function seleccionarTipo(tipo: TipoInteraccion) {
    setTipoSeleccionado(tipo);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (loading) {
    return (
      <div className="p-5 max-w-6xl mx-auto space-y-4 animate-pulse">
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-64 bg-gray-100 rounded-xl" />
          <div className="col-span-2 h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-gray-400">Cliente no encontrado</p>
        <button onClick={() => navigate('/clientes')} className="text-emerald-600 text-sm mt-2 hover:underline">Volver</button>
      </div>
    );
  }

  const { operaciones, interacciones, tareas, recibos, remitos, ...cliente } = data;
  const estadoInfo = ESTADO_CLIENTE[cliente.estado] ?? ESTADO_CLIENTE.activo;
  const esEmpresa = cliente.tipo_persona === 'juridica';
  const nombre = nombreMostrado(cliente);
  const tareasPendientes = tareas.filter(t => !t.completada);
  const tareasCompletadas = tareas.filter(t => t.completada);

  // Timeline: merge interacciones + operaciones como eventos
  const timeline = [
    ...interacciones.map(i => ({ ...i, _type: 'interaccion' as const })),
    ...operaciones.map(o => ({
      id: o.id, _type: 'operacion' as const,
      tipo: o.estado, numero: o.numero,
      descripcion: `${ESTADO_OP_LABEL[o.estado] ?? o.estado} — ${o.numero}`,
      precio_total: o.precio_total,
      created_at: o.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-4">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clientes')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={17} className="text-gray-500" />
          </button>

          {/* Avatar */}
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            esEmpresa ? 'bg-blue-100' : 'bg-emerald-100')}>
            {esEmpresa
              ? <Building2 size={22} className="text-blue-600" />
              : <User size={22} className="text-emerald-600" />}
          </div>

          {/* Nombre + estado */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 truncate">{nombre}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', estadoInfo.bg, estadoInfo.color)}>
                {estadoInfo.label}
              </span>
              {(cliente.categoria as any) && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: (cliente.categoria as any).color + '20', color: (cliente.categoria as any).color }}>
                  {(cliente.categoria as any).nombre}
                </span>
              )}
            </div>
            {/* Stats rápidas */}
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {cliente.documento_nro && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Hash size={11} /> {esEmpresa ? 'CUIT' : 'DNI'} {cliente.documento_nro}
                </span>
              )}
              {cliente.telefono && (
                <a href={`tel:${cliente.telefono}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600">
                  <Phone size={11} /> {cliente.telefono}
                </a>
              )}
              {cliente.email && (
                <a href={`mailto:${cliente.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600">
                  <Mail size={11} /> {cliente.email}
                </a>
              )}
              {(cliente.direccion || cliente.localidad) && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={11} />
                  {[cliente.direccion, cliente.localidad].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Métricas */}
          <div className="hidden lg:flex items-center gap-6 border-l border-gray-100 pl-6">
            <div className="text-center">
              <p className="text-xs text-gray-400">Operaciones</p>
              <p className="text-xl font-bold text-gray-800">{cliente.operaciones_count ?? 0}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Histórico</p>
              <p className="text-lg font-bold text-gray-800">{formatCurrency(cliente.valor_total_historico ?? 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Sin contacto</p>
              <p className={cn('text-lg font-bold', diasColor(cliente.dias_sin_contacto))}>
                {cliente.dias_sin_contacto != null ? `${cliente.dias_sin_contacto}d` : '—'}
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/clientes/${cliente.id}/editar`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Editar cliente">
              <Edit3 size={16} className="text-gray-500" />
            </Link>
            <button onClick={handleEliminar}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar cliente">
              <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
            </button>
            <Link
              to={`/operaciones/nueva?cliente_id=${cliente.id}&cliente_nombre=${encodeURIComponent(nombre)}`}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all">
              <Plus size={14} /> Nueva operación
            </Link>
          </div>
        </div>
      </div>

      {/* ── Cuerpo: 3 columnas ───────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Columna izq: Tareas */}
        <div className="col-span-12 lg:col-span-4 space-y-4">

          {/* Tareas pendientes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-amber-50">
              <Clock size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Tareas pendientes
              </span>
              {tareasPendientes.length > 0 && (
                <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                  {tareasPendientes.length}
                </span>
              )}
              <button onClick={() => setMostrarFormTarea(v => !v)}
                className="ml-auto p-1 hover:bg-amber-100 rounded transition-colors">
                <Plus size={14} className="text-amber-600" />
              </button>
            </div>

            {mostrarFormTarea && (
              <div className="p-3 border-b border-gray-100 bg-gray-50 space-y-2">
                <input
                  autoFocus
                  value={nuevaTarea.descripcion}
                  onChange={e => setNuevaTarea(p => ({ ...p, descripcion: e.target.value }))}
                  placeholder="Descripción de la tarea..."
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyDown={e => { if (e.key === 'Enter') guardarTarea(); if (e.key === 'Escape') setMostrarFormTarea(false); }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={nuevaTarea.vencimiento}
                    onChange={e => setNuevaTarea(p => ({ ...p, vencimiento: e.target.value }))}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <select value={nuevaTarea.prioridad}
                    onChange={e => setNuevaTarea(p => ({ ...p, prioridad: e.target.value }))}
                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none bg-white">
                    <option value="alta">🔴 Alta</option>
                    <option value="normal">🟡 Normal</option>
                    <option value="baja">🟢 Baja</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={guardarTarea} disabled={savingTarea || !nuevaTarea.descripcion.trim()}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs rounded-lg font-medium">
                    {savingTarea ? '...' : 'Guardar tarea'}
                  </button>
                  <button onClick={() => setMostrarFormTarea(false)}
                    className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg hover:bg-gray-100">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {tareasPendientes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-5">Sin tareas pendientes</p>
              ) : tareasPendientes.map(tarea => {
                const vencida = tarea.vencimiento && new Date(tarea.vencimiento) < new Date();
                return (
                  <div key={tarea.id} className="flex items-start gap-2.5 px-3 py-2.5 group hover:bg-gray-50">
                    <button onClick={() => toggleTarea(tarea.id, true)}
                      className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 hover:border-emerald-500 hover:bg-emerald-50 shrink-0 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{tarea.descripcion}</p>
                      {tarea.vencimiento && (
                        <p className={cn('text-xs mt-0.5 flex items-center gap-1', vencida ? 'text-red-500 font-medium' : 'text-gray-400')}>
                          <Calendar size={10} />
                          {vencida ? '¡Vencida! ' : ''}{formatDate(tarea.vencimiento)}
                        </p>
                      )}
                    </div>
                    <button onClick={() => eliminarTarea(tarea.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-300 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {tareasCompletadas.length > 0 && (
              <details className="border-t border-gray-100">
                <summary className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 cursor-pointer hover:bg-gray-50 select-none">
                  <ChevronDown size={12} /> {tareasCompletadas.length} completadas
                </summary>
                <div className="divide-y divide-gray-50">
                  {tareasCompletadas.map(tarea => (
                    <div key={tarea.id} className="flex items-start gap-2.5 px-3 py-2 group opacity-60">
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-500 line-through flex-1">{tarea.descripcion}</p>
                      <button onClick={() => eliminarTarea(tarea.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-300">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Operaciones resumen */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <ClipboardList size={14} className="text-emerald-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Operaciones</span>
              <span className="ml-auto text-xs text-gray-400">{operaciones.length}</span>
            </div>
            {operaciones.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-5">Sin operaciones todavía</p>
            ) : (
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {operaciones.map(op => (
                  <Link key={op.id} to={`/operaciones/${op.id}`}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{op.numero}</p>
                      <p className="text-xs text-gray-400">{formatDate(op.created_at)}</p>
                    </div>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', ESTADO_OP_COLOR[op.estado])}>
                      {ESTADO_OP_LABEL[op.estado]}
                    </span>
                    <p className="text-xs font-semibold text-gray-700 shrink-0">{formatCurrency(op.precio_total)}</p>
                  </Link>
                ))}
              </div>
            )}
            <div className="px-3 py-2 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <TrendingUp size={11} /> Total histórico
              </span>
              <span className="text-sm font-bold text-gray-700">{formatCurrency(cliente.valor_total_historico ?? 0)}</span>
            </div>
          </div>

          {/* Recibos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Receipt size={14} className="text-emerald-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex-1">Recibos</span>
              <span className="text-xs text-gray-400">{recibos.length}</span>
            </div>
            {recibos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin recibos</p>
            ) : (
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {recibos.map(r => (
                  <Link key={r.id} to={`/recibos/${r.id}/editar`}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{r.numero}</p>
                      <p className="text-[10px] text-gray-400">
                        {formatDate(r.fecha)}
                        {r.operacion && ` · ${r.operacion.numero}`}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-emerald-700 shrink-0">{formatCurrency(Number(r.monto_total))}</p>
                  </Link>
                ))}
              </div>
            )}
            <div className="px-3 py-2 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">Total cobrado</span>
              <span className="text-sm font-bold text-emerald-700">
                {formatCurrency(recibos.reduce((s, r) => s + Number(r.monto_total), 0))}
              </span>
            </div>
          </div>

          {/* Remitos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Truck size={14} className="text-blue-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex-1">Remitos</span>
              <span className="text-xs text-gray-400">{remitos.length}</span>
            </div>
            {remitos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin remitos</p>
            ) : (
              <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {remitos.map(rm => (
                  <Link key={rm.id} to={`/remitos/${rm.id}/editar`}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{rm.numero}</p>
                      <p className="text-[10px] text-gray-400">
                        {formatDate(rm.fecha_emision)}
                        {rm.operacion && ` · ${rm.operacion.numero}`}
                      </p>
                    </div>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      rm.estado === 'entregado' ? 'bg-emerald-100 text-emerald-700' :
                      rm.estado === 'emitido'   ? 'bg-blue-100 text-blue-700' :
                                                  'bg-gray-100 text-gray-600'
                    )}>
                      {rm.estado}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notas del cliente */}
          {cliente.notas && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notas del cliente</p>
              <p className="text-xs text-amber-800">{cliente.notas}</p>
            </div>
          )}
        </div>

        {/* Columna der: Timeline */}
        <div className="col-span-12 lg:col-span-8 space-y-3">

          {/* Registro de interacción rápida */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Botones de tipo */}
            <div className="flex items-center gap-1 px-3 pt-3 pb-2 flex-wrap">
              {TIPOS_QUICK.map(tipo => {
                const cfg = TIPO_INTERACCION[tipo];
                const Icon = cfg.icon;
                const activo = tipoSeleccionado === tipo;
                return (
                  <button key={tipo} onClick={() => seleccionarTipo(tipo)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      activo
                        ? `${cfg.bg} ${cfg.color} border-current/20`
                        : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                    )}>
                    <Icon size={12} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {/* Input */}
            <div className="flex gap-2 px-3 pb-3">
              <textarea
                ref={inputRef}
                value={textoInteraccion}
                onChange={e => setTextoInteraccion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardarInteraccion(); } }}
                rows={2}
                placeholder={`Registrar ${TIPO_INTERACCION[tipoSeleccionado].label.toLowerCase()}... (Enter para guardar, Shift+Enter para nueva línea)`}
                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={guardarInteraccion} disabled={savingInt || !textoInteraccion.trim()}
                className="self-end px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg transition-all shrink-0">
                {savingInt ? '...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Clock size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Historial de actividad
              </span>
              <span className="ml-auto text-xs text-gray-400">{timeline.length} eventos</span>
            </div>

            {timeline.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">Sin actividad registrada</p>
                <p className="text-xs text-gray-400 mt-1">Registrá la primera interacción arriba</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                {timeline.map(evento => {
                  if (evento._type === 'interaccion') {
                    const cfg = TIPO_INTERACCION[evento.tipo as TipoInteraccion] ?? TIPO_INTERACCION.nota;
                    const Icon = cfg.icon;
                    return (
                      <div key={`int-${evento.id}`} className="flex gap-3 px-4 py-3 group hover:bg-gray-50">
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                          <Icon size={13} className={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[11px] font-semibold', cfg.color)}>{cfg.label}</span>
                            <span className="text-[11px] text-gray-400">
                              {formatDate(evento.created_at)}
                              {(evento as Interaccion).created_by_usuario?.nombre
                                ? ` · ${(evento as Interaccion).created_by_usuario!.nombre}`
                                : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5 leading-snug">{evento.descripcion}</p>
                        </div>
                        <button
                          onClick={() => eliminarInteraccion(evento.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-300 transition-all self-start">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  } else {
                    // Evento de operación
                    const op = evento as any;
                    const colorClass = ESTADO_OP_COLOR[op.tipo] ?? 'bg-gray-100 text-gray-600';
                    return (
                      <Link key={`op-${op.id}`} to={`/operaciones/${op.id}`}
                        className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                          <ClipboardList size={13} className="text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-emerald-600">Operación</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', colorClass)}>
                              {ESTADO_OP_LABEL[op.tipo]}
                            </span>
                            <span className="text-[11px] text-gray-400">{formatDate(op.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm font-medium text-gray-700">{op.numero}</p>
                            {op.precio_total > 0 && (
                              <p className="text-xs text-gray-500">{formatCurrency(op.precio_total)}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
