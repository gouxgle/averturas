import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, MapPin, Plus, MessageSquare, PhoneCall,
  Navigation, MessageCircle, Send, FileText, CheckCircle2, AlertTriangle,
  Shield, Building2, User, Hash, Calendar, Clock, Trash2,
  ChevronDown, ClipboardList, TrendingUp, Edit3, Receipt, Truck,
  MoreVertical, Gift, Star, Target, DollarSign,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Cliente, Operacion, Interaccion, Tarea, TipoInteraccion, EstadoCliente } from '@/types';

// ── Helpers ─────────────────────────────────────────────────
const ESTADO_CLIENTE: Record<EstadoCliente, { label: string; color: string; bg: string; border: string }> = {
  prospecto:  { label: 'Prospecto',    color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200' },
  activo:     { label: 'Activo',       color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' },
  recurrente: { label: 'Cliente VIP',  color: 'text-purple-700',  bg: 'bg-purple-100',  border: 'border-purple-200' },
  inactivo:   { label: 'Inactivo',     color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-200' },
  perdido:    { label: 'Perdido',      color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-200' },
};

const CRM_ETAPA_MAP: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:           { label: 'Nuevo lead',     color: 'text-gray-600',    bg: 'bg-gray-100' },
  presupuestado:   { label: 'Presupuestado',  color: 'text-blue-700',    bg: 'bg-blue-100' },
  en_decision:     { label: 'En decisión',    color: 'text-amber-700',   bg: 'bg-amber-100' },
  cerrado_ganado:  { label: 'Ganado',         color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cerrado_perdido: { label: 'Perdido',        color: 'text-red-700',     bg: 'bg-red-100' },
};

const ESTADO_OP_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-indigo-100 text-indigo-700',
  cancelado:     'bg-red-100 text-red-700',
};
const ESTADO_OP_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

const TIPO_INTERACCION: Record<TipoInteraccion, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  nota:                 { label: 'Nota',               icon: MessageSquare, color: 'text-gray-600',    bg: 'bg-gray-100' },
  llamada:              { label: 'Llamada',             icon: PhoneCall,     color: 'text-emerald-600', bg: 'bg-emerald-100' },
  visita:               { label: 'Visita',              icon: Navigation,    color: 'text-blue-600',    bg: 'bg-blue-100' },
  whatsapp:             { label: 'WhatsApp',            icon: MessageCircle, color: 'text-green-600',   bg: 'bg-green-100' },
  email:                { label: 'Email',               icon: Send,          color: 'text-sky-600',     bg: 'bg-sky-100' },
  presupuesto_enviado:  { label: 'Presupuesto enviado', icon: FileText,      color: 'text-violet-600',  bg: 'bg-violet-100' },
  operacion_completada: { label: 'Trabajo completado',  icon: CheckCircle2,  color: 'text-teal-600',    bg: 'bg-teal-100' },
  reclamo:              { label: 'Reclamo',             icon: AlertTriangle, color: 'text-red-600',     bg: 'bg-red-100' },
  garantia:             { label: 'Garantía',            icon: Shield,        color: 'text-amber-600',   bg: 'bg-amber-100' },
};

const TIPOS_QUICK: TipoInteraccion[] = ['llamada', 'visita', 'whatsapp', 'nota', 'email', 'reclamo'];

const TABS = [
  { key: 'historial',    label: 'Historial',    icon: Clock },
  { key: 'presupuestos', label: 'Presupuestos', icon: FileText },
  { key: 'operaciones',  label: 'Operaciones',  icon: ClipboardList },
  { key: 'remitos',      label: 'Remitos',      icon: Truck },
  { key: 'recibos',      label: 'Recibos',      icon: Receipt },
  { key: 'beneficios',   label: 'Beneficios',   icon: Gift },
] as const;
type TabKey = typeof TABS[number]['key'];

function nombreMostrado(c: Partial<Cliente>) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
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
  crm_etapa?: string;
  interes?: string;
  producto_interes?: string;
  monto_estimado?: number;
  probabilidad?: number;
  asignado_a?: string;
  proxima_accion?: string;
  proxima_accion_fecha?: string;
}

// ── Componente principal ─────────────────────────────────────
export function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ClienteConDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('historial');

  // Interacción rápida
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoInteraccion>('nota');
  const [textoInteraccion, setTextoInteraccion] = useState('');
  const [savingInt, setSavingInt] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Nueva tarea
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState({ descripcion: '', vencimiento: '', prioridad: 'normal' });
  const [savingTarea, setSavingTarea] = useState(false);

  // Menú más acciones
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Historial: colapsar tareas completadas
  const [showCompletadas, setShowCompletadas] = useState(false);

  async function load() {
    if (!id) return;
    try {
      const result = await api.get<ClienteConDetalle>(`/clientes/${id}`);
      setData(result);
    } catch {
      toast.error('Error al cargar el cliente');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    if (!data) return;
    try {
      await api.delete(`/clientes/${id}`);
      toast.success('Cliente eliminado');
      navigate('/clientes');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo eliminar');
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="p-5 max-w-6xl mx-auto space-y-4 animate-pulse">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-96 bg-gray-100 rounded-xl" />
          <div className="col-span-2 h-96 bg-gray-100 rounded-xl" />
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

  // Stats calculadas
  const presupuestosLista = operaciones.filter(o => ['presupuesto', 'enviado'].includes(o.estado));
  const operacionesActivas = operaciones.filter(o => !['presupuesto', 'enviado', 'cancelado'].includes(o.estado));
  const cobrosTotal = recibos.reduce((s, r) => s + Number(r.monto_total), 0);

  // Timeline (historial)
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

  const crmEtapa = data.crm_etapa ? CRM_ETAPA_MAP[data.crm_etapa] : null;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/clientes')}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={17} className="text-gray-500" />
          </button>

          {/* Avatar */}
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
            esEmpresa ? 'bg-blue-50' : 'bg-emerald-50')}>
            {esEmpresa
              ? <Building2 size={20} className="text-blue-600" />
              : <User size={20} className="text-emerald-600" />}
          </div>

          {/* Nombre + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-gray-900 truncate">{nombre}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium border shrink-0',
                estadoInfo.bg, estadoInfo.color, estadoInfo.border)}>
                {estadoInfo.label}
              </span>
              {crmEtapa && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', crmEtapa.bg, crmEtapa.color)}>
                  {crmEtapa.label}
                </span>
              )}
              {(cliente.categoria as any)?.nombre && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: (cliente.categoria as any).color + '20', color: (cliente.categoria as any).color }}>
                  {(cliente.categoria as any).nombre}
                </span>
              )}
            </div>
            {/* Contacto rápido */}
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {cliente.telefono && (
                <a href={`tel:${cliente.telefono}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600">
                  <Phone size={10} /> {cliente.telefono}
                </a>
              )}
              {cliente.email && (
                <a href={`mailto:${cliente.email}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600">
                  <Mail size={10} /> {cliente.email}
                </a>
              )}
              {cliente.localidad && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <MapPin size={10} /> {cliente.localidad}
                </span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/clientes/${cliente.id}/editar`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition-colors">
              <Edit3 size={14} /> Editar
            </Link>

            {/* Más acciones dropdown */}
            <div className="relative" ref={moreRef}>
              <button onClick={() => setShowMore(v => !v)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">
                <MoreVertical size={15} className="text-gray-500" />
              </button>
              {showMore && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                  <Link to={`/clientes/${cliente.id}/estado-cuenta`}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setShowMore(false)}>
                    <Receipt size={14} className="text-gray-400" /> Estado de cuenta
                  </Link>
                  <Link to={`/presupuestos/nuevo?cliente_id=${cliente.id}&cliente_nombre=${encodeURIComponent(nombre)}`}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setShowMore(false)}>
                    <FileText size={14} className="text-gray-400" /> Nuevo presupuesto
                  </Link>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => { setShowMore(false); setShowDeleteConfirm(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} /> Eliminar cliente
                  </button>
                </div>
              )}
            </div>

            <Link
              to={`/operaciones/nueva?cliente_id=${cliente.id}&cliente_nombre=${encodeURIComponent(nombre)}`}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all">
              <Plus size={14} /> Nueva operación
            </Link>
          </div>
        </div>
      </div>

      {/* ── Confirmación eliminar ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-800 mb-1">¿Eliminar a {nombre}?</p>
          <p className="text-xs text-red-600 mb-3">Esta acción no se puede deshacer. Solo se puede eliminar si no tiene operaciones asociadas.</p>
          <div className="flex gap-2">
            <button onClick={handleEliminar}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium">
              Sí, eliminar
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-1.5 border border-red-200 text-red-700 text-sm rounded-lg hover:bg-red-100">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Stats row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button onClick={() => setActiveTab('presupuestos')}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:border-blue-200 hover:shadow transition-all">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-blue-500" />
            <span className="text-xs text-gray-500">Presupuestos</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{presupuestosLista.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">activos</p>
        </button>

        <button onClick={() => setActiveTab('operaciones')}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:border-emerald-200 hover:shadow transition-all">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={14} className="text-emerald-500" />
            <span className="text-xs text-gray-500">Operaciones</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{operacionesActivas.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">en curso / históricas</p>
        </button>

        <button onClick={() => setActiveTab('remitos')}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:border-indigo-200 hover:shadow transition-all">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={14} className="text-indigo-500" />
            <span className="text-xs text-gray-500">Remitos</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{remitos.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">entregas</p>
        </button>

        <button onClick={() => setActiveTab('recibos')}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:border-teal-200 hover:shadow transition-all">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-teal-500" />
            <span className="text-xs text-gray-500">Compras totales</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{formatCurrency(cobrosTotal)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">cobrado</p>
        </button>
      </div>

      {/* ── Cuerpo: 2 columnas ───────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Columna izq: Info + CRM */}
        <div className="col-span-12 lg:col-span-4 space-y-3">

          {/* Info general */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Info general</span>
              <Link to={`/clientes/${cliente.id}/editar`}
                className="text-xs text-emerald-600 hover:underline">Editar</Link>
            </div>
            <div className="p-4 space-y-3">
              {cliente.documento_nro && (
                <div className="flex items-center gap-2">
                  <Hash size={13} className="text-gray-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">{esEmpresa ? 'CUIT' : 'DNI'}</p>
                    <p className="text-sm text-gray-700 font-medium">{cliente.documento_nro}</p>
                  </div>
                </div>
              )}
              {(cliente.telefono || cliente.telefono_fijo) && (
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-gray-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Teléfono</p>
                    {cliente.telefono && <a href={`tel:${cliente.telefono}`} className="text-sm text-gray-700 hover:text-emerald-600 block">{cliente.telefono}</a>}
                    {cliente.telefono_fijo && <a href={`tel:${cliente.telefono_fijo}`} className="text-xs text-gray-500 hover:text-emerald-600 block">{cliente.telefono_fijo} (fijo)</a>}
                  </div>
                </div>
              )}
              {(cliente.email || cliente.email_alternativo) && (
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-gray-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Email</p>
                    {cliente.email && <a href={`mailto:${cliente.email}`} className="text-sm text-gray-700 hover:text-emerald-600 block truncate max-w-[180px]">{cliente.email}</a>}
                    {cliente.email_alternativo && <a href={`mailto:${cliente.email_alternativo}`} className="text-xs text-gray-500 hover:text-emerald-600 block truncate max-w-[180px]">{cliente.email_alternativo}</a>}
                  </div>
                </div>
              )}
              {(cliente.direccion || cliente.localidad) && (
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="text-gray-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Domicilio</p>
                    {cliente.direccion && <p className="text-sm text-gray-700">{cliente.direccion}</p>}
                    {cliente.localidad && <p className="text-xs text-gray-500">{cliente.localidad}{cliente.codigo_postal ? ` (${cliente.codigo_postal})` : ''}</p>}
                  </div>
                </div>
              )}
              {cliente.condicion_iva && (
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-gray-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Condición IVA</p>
                    <p className="text-sm text-gray-700">{cliente.condicion_iva}</p>
                  </div>
                </div>
              )}
              {cliente.origen && (
                <div className="flex items-center gap-2">
                  <Target size={13} className="text-gray-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Origen</p>
                    <p className="text-sm text-gray-700">{cliente.origen}</p>
                  </div>
                </div>
              )}
              {cliente.ultima_interaccion && (
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-gray-300 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Último contacto</p>
                    <p className="text-sm text-gray-700">{formatDate(cliente.ultima_interaccion)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CRM */}
          {(data.crm_etapa || data.interes || data.producto_interes || data.proxima_accion || data.monto_estimado) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Clasificación CRM</span>
              </div>
              <div className="p-4 space-y-3">
                {data.crm_etapa && (
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Etapa</p>
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium',
                      crmEtapa?.bg ?? 'bg-gray-100', crmEtapa?.color ?? 'text-gray-600')}>
                      {crmEtapa?.label ?? data.crm_etapa}
                    </span>
                  </div>
                )}
                {data.interes && (
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Interés</p>
                    <p className="text-sm text-gray-700 mt-0.5">{data.interes}</p>
                  </div>
                )}
                {data.producto_interes && (
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Producto de interés</p>
                    <p className="text-sm text-gray-700 mt-0.5">{data.producto_interes}</p>
                  </div>
                )}
                {data.monto_estimado != null && data.monto_estimado > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Monto estimado</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">{formatCurrency(data.monto_estimado)}</p>
                  </div>
                )}
                {data.probabilidad != null && (
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none mb-1">Probabilidad</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${data.probabilidad}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600">{data.probabilidad}%</span>
                    </div>
                  </div>
                )}
                {data.proxima_accion && (
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none">Próxima acción</p>
                    <p className="text-sm text-gray-700 mt-0.5">{data.proxima_accion}</p>
                    {data.proxima_accion_fecha && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(data.proxima_accion_fecha)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notas */}
          {cliente.notas && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notas</p>
              <p className="text-sm text-amber-800 leading-relaxed">{cliente.notas}</p>
            </div>
          )}

          {/* Valor histórico */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-xs text-gray-500">Valor histórico total</span>
              </div>
              <span className="text-base font-bold text-gray-800">{formatCurrency(cliente.valor_total_historico ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Columna der: Tabs */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                // Badge counts
                let badge = 0;
                if (tab.key === 'presupuestos') badge = presupuestosLista.length;
                else if (tab.key === 'operaciones') badge = operacionesActivas.length;
                else if (tab.key === 'remitos') badge = remitos.length;
                else if (tab.key === 'recibos') badge = recibos.length;
                else if (tab.key === 'historial') badge = tareasPendientes.length;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                      isActive
                        ? 'text-emerald-600 border-emerald-500 bg-emerald-50/50'
                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                    )}>
                    <Icon size={13} />
                    {tab.label}
                    {badge > 0 && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Tab: Historial ───────────────────────── */}
            {activeTab === 'historial' && (
              <div className="divide-y divide-gray-100">
                {/* Registrar interacción */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    {TIPOS_QUICK.map(tipo => {
                      const cfg = TIPO_INTERACCION[tipo];
                      const Icon = cfg.icon;
                      const activo = tipoSeleccionado === tipo;
                      return (
                        <button key={tipo}
                          onClick={() => { setTipoSeleccionado(tipo); setTimeout(() => inputRef.current?.focus(), 50); }}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                            activo
                              ? `${cfg.bg} ${cfg.color} border-current/20`
                              : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                          )}>
                          <Icon size={12} /> {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      ref={inputRef}
                      value={textoInteraccion}
                      onChange={e => setTextoInteraccion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardarInteraccion(); } }}
                      rows={2}
                      placeholder={`Registrar ${TIPO_INTERACCION[tipoSeleccionado].label.toLowerCase()}...`}
                      className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button onClick={guardarInteraccion} disabled={savingInt || !textoInteraccion.trim()}
                      className="self-end px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg transition-all shrink-0">
                      {savingInt ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>

                {/* Tareas pendientes */}
                <div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
                    <Clock size={13} className="text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700">Tareas pendientes</span>
                    {tareasPendientes.length > 0 && (
                      <span className="ml-1 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                        {tareasPendientes.length}
                      </span>
                    )}
                    <button onClick={() => setMostrarFormTarea(v => !v)}
                      className="ml-auto p-1 hover:bg-amber-100 rounded transition-colors">
                      <Plus size={13} className="text-amber-600" />
                    </button>
                  </div>

                  {mostrarFormTarea && (
                    <div className="p-3 bg-gray-50 border-b border-gray-100 space-y-2">
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
                          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none">
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

                  {tareasPendientes.length === 0 && !mostrarFormTarea ? (
                    <p className="text-xs text-gray-400 text-center py-4">Sin tareas pendientes</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {tareasPendientes.map(tarea => {
                        const vencida = tarea.vencimiento && new Date(tarea.vencimiento) < new Date();
                        return (
                          <div key={tarea.id} className="flex items-start gap-2.5 px-4 py-2.5 group hover:bg-gray-50">
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
                  )}

                  {tareasCompletadas.length > 0 && (
                    <div className="border-t border-gray-100">
                      <button onClick={() => setShowCompletadas(v => !v)}
                        className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 transition-colors">
                        <ChevronDown size={12} className={cn('transition-transform', showCompletadas ? 'rotate-180' : '')} />
                        {tareasCompletadas.length} completadas
                      </button>
                      {showCompletadas && (
                        <div className="divide-y divide-gray-50">
                          {tareasCompletadas.map(tarea => (
                            <div key={tarea.id} className="flex items-start gap-2.5 px-4 py-2 group opacity-60">
                              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-500 line-through flex-1">{tarea.descripcion}</p>
                              <button onClick={() => eliminarTarea(tarea.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-300">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                    <Clock size={13} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500">Historial de actividad</span>
                    <span className="ml-auto text-xs text-gray-400">{timeline.length} eventos</span>
                  </div>
                  {timeline.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-gray-400">Sin actividad registrada</p>
                      <p className="text-xs text-gray-400 mt-1">Registrá la primera interacción arriba</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
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
                              <button onClick={() => eliminarInteraccion(evento.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-300 transition-all self-start">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        } else {
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
            )}

            {/* ── Tab: Presupuestos ────────────────────── */}
            {activeTab === 'presupuestos' && (
              <div>
                {presupuestosLista.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Sin presupuestos activos</p>
                    <Link to={`/presupuestos/nuevo?cliente_id=${cliente.id}&cliente_nombre=${encodeURIComponent(nombre)}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-600 hover:underline">
                      <Plus size={14} /> Crear presupuesto
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {presupuestosLista.map(op => (
                      <Link key={op.id} to={`/presupuestos?id=${op.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{op.numero}</p>
                          <p className="text-xs text-gray-400">{formatDate(op.created_at)}</p>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', ESTADO_OP_COLOR[op.estado])}>
                          {ESTADO_OP_LABEL[op.estado]}
                        </span>
                        <p className="text-sm font-semibold text-gray-700 shrink-0">{formatCurrency(op.precio_total)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Operaciones ─────────────────────── */}
            {activeTab === 'operaciones' && (
              <div>
                {operacionesActivas.length === 0 ? (
                  <div className="py-12 text-center">
                    <ClipboardList size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Sin operaciones</p>
                    <Link to={`/operaciones/nueva?cliente_id=${cliente.id}&cliente_nombre=${encodeURIComponent(nombre)}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-600 hover:underline">
                      <Plus size={14} /> Nueva operación
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {operacionesActivas.map(op => (
                      <Link key={op.id} to={`/operaciones/${op.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{op.numero}</p>
                          <p className="text-xs text-gray-400">{formatDate(op.created_at)}</p>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', ESTADO_OP_COLOR[op.estado])}>
                          {ESTADO_OP_LABEL[op.estado]}
                        </span>
                        <p className="text-sm font-semibold text-gray-700 shrink-0">{formatCurrency(op.precio_total)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Remitos ─────────────────────────── */}
            {activeTab === 'remitos' && (
              <div>
                {remitos.length === 0 ? (
                  <div className="py-12 text-center">
                    <Truck size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Sin remitos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {remitos.map(rm => (
                      <Link key={rm.id} to={`/remitos/${rm.id}/editar`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{rm.numero}</p>
                          <p className="text-xs text-gray-400">
                            {formatDate(rm.fecha_emision)}
                            {rm.operacion && ` · ${rm.operacion.numero}`}
                          </p>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                          rm.estado === 'entregado' ? 'bg-indigo-100 text-indigo-700' :
                          rm.estado === 'emitido'   ? 'bg-blue-100 text-blue-700' :
                                                      'bg-gray-100 text-gray-600')}>
                          {rm.estado}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Recibos ─────────────────────────── */}
            {activeTab === 'recibos' && (
              <div>
                {recibos.length === 0 ? (
                  <div className="py-12 text-center">
                    <Receipt size={32} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Sin recibos emitidos</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {recibos.map(r => (
                        <Link key={r.id} to={`/recibos/${r.id}/editar`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{r.numero}</p>
                            <p className="text-xs text-gray-400">
                              {formatDate(r.fecha)} · {r.forma_pago}
                              {r.operacion && ` · ${r.operacion.numero}`}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-emerald-700 shrink-0">{formatCurrency(Number(r.monto_total))}</p>
                        </Link>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                      <span className="text-xs text-gray-500">Total cobrado</span>
                      <span className="text-base font-bold text-emerald-700">{formatCurrency(cobrosTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Tab: Beneficios ──────────────────────── */}
            {activeTab === 'beneficios' && (
              <div className="py-14 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                  <Star size={24} className="text-amber-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Programa de beneficios</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  El sistema de puntos y beneficios estará disponible próximamente.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
