import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Phone, MessageCircle, Calendar, AlertTriangle, Star,
  TrendingUp, Users, CheckSquare, Clock, ChevronRight,
  Gift, Package, BarChart2, Zap, X, Check,
  ArrowRight, RefreshCw, Cake,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ClientePipeline {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  crm_etapa: string;
  interes: string | null;
  producto_interes: string | null;
  monto_estimado: number | null;
  dias_sin_contacto: number;
  ultimo_op_monto: number | null;
  proxima_accion: string | null;
  proxima_accion_fecha: string | null;
  asignado_nombre: string | null;
}

interface TareaHoy {
  id: string;
  descripcion: string;
  tipo_accion: string | null;
  hora: string | null;
  prioridad: string | null;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  cliente_id: string;
  telefono: string | null;
}

interface Cumpleanos {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  cumple_label: string;
  dias_para_cumple: number;
}

interface PresupuestoAlerta {
  cliente_id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  op_id: string;
  numero: string;
  precio_total: number;
  dias_sin_respuesta: number;
}

interface OportunidadInactiva {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  crm_etapa: string;
  ultima_interaccion: string | null;
  dias_sin_contacto: number;
  monto_estimado: number | null;
}

interface TopCliente {
  id: string;
  nombre: string;
  apellido: string;
  razon_social: string;
  tipo_persona: string;
  valor_total_historico: number;
  operaciones_count: number;
  referidos_count: number;
}

interface TableroData {
  kpis: {
    leads_nuevos: number; leads_nuevos_vs: number;
    en_seguimiento: number; presupuestados: number;
    ventas_cerradas: number; tasa_cierre: number;
    ventas_totales: number; ventas_vs_anterior: number;
    clientes_activos: number; en_postventa: number;
    tareas_pendientes: number; facturacion_mes: number;
  };
  pipeline: {
    nuevo: ClientePipeline[]; en_contacto: ClientePipeline[];
    presupuestado: ClientePipeline[]; en_decision: ClientePipeline[];
    cerrado: ClientePipeline[]; postventa: ClientePipeline[];
  };
  embudo: Array<{ etapa: string; count: number; pct: number }>;
  seguimientos_hoy: TareaHoy[];
  origen_leads: Array<{ origen: string; cant: number }>;
  top_clientes: TopCliente[];
  ventas_semanales: Array<{ label: string; ventas: number }>;
  cumpleanos_proximos: Cumpleanos[];
  presupuestos_sin_respuesta: PresupuestoAlerta[];
  oportunidades_inactivas: OportunidadInactiva[];
  productos_consultados: Array<{ producto: string; presupuestos: number; ventas: number }>;
  total_pipeline: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const clienteNombre = (c: { nombre?: string | null; apellido?: string | null; razon_social?: string | null; tipo_persona?: string }) =>
  c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '—')
    : [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';

const ETAPA_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  nuevo:         { label: 'Nuevos',        color: 'text-rose-600',   bg: 'bg-rose-50 border-rose-200',   dot: 'bg-rose-400' },
  en_contacto:   { label: 'En Contacto',   color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400' },
  presupuestado: { label: 'Presupuestos',  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-400' },
  en_decision:   { label: 'En Decisión',   color: 'text-sky-600',    bg: 'bg-sky-50 border-sky-200',     dot: 'bg-sky-400' },
  cerrado:       { label: 'Cerrados',      color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-400' },
  postventa:     { label: 'Postventa',     color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-200',   dot: 'bg-teal-400' },
};

const ACCION_ICON: Record<string, React.ReactNode> = {
  llamada:     <Phone size={11} />,
  whatsapp:    <MessageCircle size={11} />,
  entrega:     <Package size={11} />,
  instalacion: <Zap size={11} />,
  cobranza:    <BarChart2 size={11} />,
  cumpleanos:  <Cake size={11} />,
  seguimiento: <RefreshCw size={11} />,
  visita:      <Users size={11} />,
};

const COLORES_PIE = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#64748b'];

function VsBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  return (
    <span className={cn('text-[10px] font-bold', pct > 0 ? 'text-emerald-500' : 'text-red-500')}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}% vs mes ant.
    </span>
  );
}

// ── Modal Nuevo Lead ──────────────────────────────────────────────────────────

function ModalNuevoLead({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', origen: 'whatsapp', interes: 'medio', producto_interes: '', monto_estimado: '', notas: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await api.post('/crm/leads', { ...form, monto_estimado: form.monto_estimado ? parseFloat(form.monto_estimado) : null });
      onSuccess();
      onClose();
    } finally { setSaving(false); }
  };

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Nuevo Lead</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nombre *</label><input className={inp} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required /></div>
            <div><label className={lbl}>Apellido</label><input className={inp} value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} /></div>
          </div>
          <div><label className={lbl}>Teléfono</label><input className={inp} value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Origen</label>
              <select className={inp} value={form.origen} onChange={e => setForm(p => ({ ...p, origen: e.target.value }))}>
                {['whatsapp','instagram','facebook','referido','web','visita_local','otro'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Interés</label>
              <select className={inp} value={form.interes} onChange={e => setForm(p => ({ ...p, interes: e.target.value }))}>
                <option value="caliente">🔴 Caliente</option>
                <option value="medio">🟡 Medio</option>
                <option value="frio">🔵 Frío</option>
              </select>
            </div>
          </div>
          <div><label className={lbl}>Producto de interés</label><input className={inp} value={form.producto_interes} onChange={e => setForm(p => ({ ...p, producto_interes: e.target.value }))} placeholder="Ej: Ventana Modena 100x120" /></div>
          <div><label className={lbl}>Monto estimado</label><input type="number" className={inp} value={form.monto_estimado} onChange={e => setForm(p => ({ ...p, monto_estimado: e.target.value }))} /></div>
          <div><label className={lbl}>Notas</label><textarea className={inp} rows={2} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? 'Guardando...' : 'Crear Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal Mover Etapa ─────────────────────────────────────────────────────────

function ModalMoverEtapa({ cliente, onClose, onSuccess }: { cliente: ClientePipeline; onClose: () => void; onSuccess: () => void }) {
  const [etapa, setEtapa] = useState(cliente.crm_etapa);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/crm/clientes/${cliente.id}/etapa`, { etapa, motivo_perdida: motivo || null });
      onSuccess(); onClose();
    } finally { setSaving(false); }
  };

  const etapas = [
    { value: 'nuevo', label: 'Nuevo' },
    { value: 'en_contacto', label: 'En Contacto' },
    { value: 'presupuestado', label: 'Presupuestado' },
    { value: 'en_decision', label: 'En Decisión' },
    { value: 'cerrado_ganado', label: '✅ Ganado' },
    { value: 'postventa', label: 'Postventa' },
    { value: 'cerrado_perdido', label: '❌ Perdido' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Mover etapa</h2>
            <p className="text-xs text-gray-400">{clienteNombre(cliente)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {etapas.map(e => (
              <button key={e.value} onClick={() => setEtapa(e.value)}
                className={cn('px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-all',
                  etapa === e.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}>
                {e.label}
              </button>
            ))}
          </div>
          {etapa === 'cerrado_perdido' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Motivo de pérdida</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Precio, competencia, etc." />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? 'Guardando...' : 'Mover'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de pipeline ──────────────────────────────────────────────────────────

function PipelineCard({ cliente, onMover }: { cliente: ClientePipeline; onMover: (c: ClientePipeline) => void }) {
  const navigate = useNavigate();
  const nombre = clienteNombre(cliente);
  const diasColor = cliente.dias_sin_contacto > 15 ? 'text-red-500' : cliente.dias_sin_contacto > 7 ? 'text-amber-500' : 'text-gray-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/clientes/${cliente.id}`)}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-xs font-bold text-gray-800 leading-tight truncate flex-1">{nombre}</p>
        <button onClick={e => { e.stopPropagation(); onMover(cliente); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-violet-100 rounded transition-opacity shrink-0">
          <ArrowRight size={11} className="text-violet-500" />
        </button>
      </div>
      {cliente.producto_interes && (
        <p className="text-[10px] text-gray-400 truncate mb-1">{cliente.producto_interes}</p>
      )}
      <div className="flex items-center justify-between">
        {cliente.ultimo_op_monto || cliente.monto_estimado ? (
          <span className="text-[10px] font-bold text-gray-700">
            {formatCurrency(Number(cliente.ultimo_op_monto ?? cliente.monto_estimado))}
          </span>
        ) : <span />}
        <span className={cn('text-[9px] font-medium', diasColor)}>
          {cliente.dias_sin_contacto === 999 ? 'Sin contacto' : `Hace ${cliente.dias_sin_contacto}d`}
        </span>
      </div>
      {cliente.proxima_accion && (
        <p className="text-[9px] text-violet-500 mt-1 truncate">→ {cliente.proxima_accion}</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CRM() {
  const navigate = useNavigate();
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNuevoLead, setShowNuevoLead] = useState(false);
  const [clienteMover, setClienteMover] = useState<ClientePipeline | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await api.get<TableroData>('/crm/tablero');
      setData(result);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completarTarea = async (tareaId: string) => {
    try {
      await api.patch(`/crm/tareas/${tareaId}/completar`, {});
      setData(prev => prev ? {
        ...prev,
        seguimientos_hoy: prev.seguimientos_hoy.filter(t => t.id !== tareaId),
      } : prev);
    } catch {}
  };

  const kpis = data?.kpis;

  const KPI_CARDS = [
    { icon: <Users size={18} />, color: 'bg-rose-100 text-rose-600', label: 'Nuevos Leads', value: kpis?.leads_nuevos ?? 0, sub: <VsBadge pct={kpis?.leads_nuevos_vs ?? 0} /> },
    { icon: <Phone size={18} />, color: 'bg-amber-100 text-amber-600', label: 'Seguimientos hoy', value: data?.seguimientos_hoy.length ?? 0, sub: <span className="text-[10px] text-gray-400">tareas programadas</span> },
    { icon: <BarChart2 size={18} />, color: 'bg-violet-100 text-violet-600', label: 'Presupuestos', value: kpis?.presupuestados ?? 0, sub: <span className="text-[10px] text-gray-400">en pipeline activo</span> },
    { icon: <Check size={18} />, color: 'bg-emerald-100 text-emerald-600', label: 'Ventas Cerradas', value: kpis?.ventas_cerradas ?? 0, sub: <span className="text-[10px] text-emerald-500 font-medium">{kpis?.tasa_cierre ?? 0}% tasa de cierre</span> },
    { icon: <TrendingUp size={18} />, color: 'bg-sky-100 text-sky-600', label: 'Facturación mes', value: formatCurrency(kpis?.facturacion_mes ?? 0), sub: <VsBadge pct={kpis?.ventas_vs_anterior ?? 0} /> },
    { icon: <CheckSquare size={18} />, color: 'bg-orange-100 text-orange-600', label: 'Tareas pendientes', value: kpis?.tareas_pendientes ?? 0, sub: <span className="text-[10px] text-gray-400">próximos 7 días</span> },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 xl:p-6 space-y-5 max-w-[1600px] mx-auto">

      {/* Modales */}
      {showNuevoLead && <ModalNuevoLead onClose={() => setShowNuevoLead(false)} onSuccess={fetchData} />}
      {clienteMover && <ModalMoverEtapa cliente={clienteMover} onClose={() => setClienteMover(null)} onSuccess={fetchData} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">CRM Comercial</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestión de leads, seguimientos y pipeline de ventas</p>
        </div>
        <button onClick={() => setShowNuevoLead(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors">
          <Plus size={16} />
          Nuevo Lead
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {KPI_CARDS.map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-300 shadow-md p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', k.color)}>
                {k.icon}
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-tight">{k.label}</span>
            </div>
            <p className="text-xl font-black text-gray-900">{k.value}</p>
            <div className="mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Pipeline + Tareas ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">

        {/* Pipeline kanban */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-violet-500" />
              <span className="text-sm font-bold text-gray-800">Pipeline de Ventas</span>
              <span className="text-xs text-gray-400">{data?.total_pipeline ?? 0} oportunidades activas</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-0 min-w-max">
              {(['nuevo','en_contacto','presupuestado','en_decision','cerrado','postventa'] as const).map(etapa => {
                const cfg = ETAPA_CONFIG[etapa];
                const clientes = data?.pipeline[etapa] ?? [];
                return (
                  <div key={etapa} className="w-[190px] shrink-0 border-r border-gray-100 last:border-0">
                    {/* Header columna */}
                    <div className={cn('px-3 py-2 border-b border-gray-100 flex items-center gap-1.5', cfg.bg.split(' ')[0])}>
                      <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                      <span className={cn('text-[11px] font-bold', cfg.color)}>{cfg.label}</span>
                      <span className={cn('text-[10px] font-bold ml-auto', cfg.color)}>{clientes.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                      {clientes.length === 0 ? (
                        <div className="py-6 text-center text-[10px] text-gray-300">Sin leads</div>
                      ) : clientes.slice(0, 5).map(c => (
                        <PipelineCard key={c.id} cliente={c} onMover={setClienteMover} />
                      ))}
                      {clientes.length > 5 && (
                        <button className={cn('w-full text-center text-[10px] font-semibold py-1.5 rounded-lg border', cfg.bg, cfg.color)}>
                          + Ver todos ({clientes.length})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel de Tareas del día */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-800">Tareas y Seguimientos</span>
            </div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              hoy
            </span>
          </div>
          <div className="overflow-y-auto max-h-[340px]">
            {(data?.seguimientos_hoy ?? []).length === 0 ? (
              <div className="py-10 text-center">
                <Check size={24} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Sin tareas para hoy</p>
              </div>
            ) : (data?.seguimientos_hoy ?? []).map(t => {
              const prioColor = t.prioridad === 'alta' ? 'bg-red-500' : t.prioridad === 'normal' ? 'bg-amber-400' : 'bg-gray-300';
              return (
                <div key={t.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 group">
                  {t.hora ? (
                    <span className="text-[10px] font-bold text-gray-500 w-10 shrink-0 pt-0.5">{t.hora.slice(0, 5)}</span>
                  ) : (
                    <span className="w-10 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {t.tipo_accion && (
                        <span className="text-gray-400">{ACCION_ICON[t.tipo_accion] ?? <Clock size={11} />}</span>
                      )}
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', prioColor)} />
                      <p className="text-xs font-semibold text-gray-800 truncate">{clienteNombre(t)}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{t.descripcion}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.telefono && (
                      <a href={`https://wa.me/${t.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-1 hover:bg-green-50 rounded-lg">
                        <MessageCircle size={11} className="text-green-500" />
                      </a>
                    )}
                    <button onClick={() => completarTarea(t.id)} className="p-1 hover:bg-emerald-50 rounded-lg">
                      <Check size={11} className="text-emerald-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Fila de paneles: Agenda / Cumpleaños / Alertas / Postventa / VIP ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

        {/* Agenda de hoy */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={14} className="text-sky-500" />
            <span className="text-xs font-bold text-gray-700">Agenda de hoy</span>
          </div>
          <div className="p-3 space-y-2">
            {(data?.seguimientos_hoy ?? []).slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-600 w-9 shrink-0">{t.hora?.slice(0,5) ?? '—'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{t.descripcion}</p>
                  <p className="text-[9px] text-gray-400 truncate">{clienteNombre(t)}</p>
                </div>
              </div>
            ))}
            {(data?.seguimientos_hoy ?? []).length === 0 && (
              <p className="text-[10px] text-gray-300 text-center py-4">Sin eventos hoy</p>
            )}
            <button onClick={() => navigate('/clientes')}
              className="w-full text-[10px] text-sky-600 font-semibold hover:bg-sky-50 py-1.5 rounded-lg border border-sky-100 mt-1">
              Ver agenda completa
            </button>
          </div>
        </div>

        {/* Cumpleaños próximos */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Cake size={14} className="text-pink-500" />
            <span className="text-xs font-bold text-gray-700">Cumpleaños próximos</span>
          </div>
          <div className="p-3 space-y-2">
            {(data?.cumpleanos_proximos ?? []).length === 0 ? (
              <p className="text-[10px] text-gray-300 text-center py-4">Sin cumpleaños próximos</p>
            ) : (data?.cumpleanos_proximos ?? []).map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                  c.dias_para_cumple === 0 ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-500')}>
                  {c.dias_para_cumple === 0 ? '🎂' : c.cumple_label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{clienteNombre(c)}</p>
                  <p className={cn('text-[9px] font-medium', c.dias_para_cumple === 0 ? 'text-pink-500' : 'text-gray-400')}>
                    {c.dias_para_cumple === 0 ? '¡Hoy!' : c.dias_para_cumple === 1 ? 'Mañana' : `En ${c.dias_para_cumple} días`}
                  </p>
                </div>
                {c.telefono && (
                  <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    className="p-1.5 hover:bg-green-50 rounded-lg shrink-0">
                    <MessageCircle size={12} className="text-green-500" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-gray-700">Alertas</span>
          </div>
          <div className="p-3 space-y-2">
            {(data?.presupuestos_sin_respuesta ?? []).length === 0 &&
             (data?.oportunidades_inactivas ?? []).filter(o => o.dias_sin_contacto > 15).length === 0 ? (
              <div className="py-4 text-center">
                <Check size={18} className="text-emerald-400 mx-auto mb-1" />
                <p className="text-[10px] text-gray-400">Sin alertas pendientes</p>
              </div>
            ) : (
              <>
                {(data?.presupuestos_sin_respuesta ?? []).slice(0, 3).map(p => (
                  <div key={p.op_id} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                    <AlertTriangle size={11} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-700 truncate">{clienteNombre(p)}</p>
                      <p className="text-[9px] text-amber-600">Presupuesto sin respuesta · {p.dias_sin_respuesta}d</p>
                    </div>
                    <button onClick={() => navigate('/presupuestos')}
                      className="text-[9px] text-amber-600 font-bold hover:underline shrink-0">Ver</button>
                  </div>
                ))}
                {(data?.oportunidades_inactivas ?? []).filter(o => o.dias_sin_contacto > 15).slice(0, 2).map(o => (
                  <div key={o.id} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
                    <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-700 truncate">{clienteNombre(o)}</p>
                      <p className="text-[9px] text-red-400">Sin contacto · {o.dias_sin_contacto}d</p>
                    </div>
                    <button onClick={() => navigate(`/clientes/${o.id}`)}
                      className="text-[9px] text-red-400 font-bold hover:underline shrink-0">Ver</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Postventa pendiente */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <RefreshCw size={14} className="text-teal-500" />
            <span className="text-xs font-bold text-gray-700">Postventa pendiente</span>
          </div>
          <div className="p-3 space-y-2">
            {(data?.pipeline.postventa ?? []).length === 0 ? (
              <p className="text-[10px] text-gray-300 text-center py-4">Sin clientes en postventa</p>
            ) : (data?.pipeline.postventa ?? []).slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-0.5"
                onClick={() => navigate(`/clientes/${c.id}`)}>
                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center shrink-0 text-[9px] font-bold text-teal-600">
                  {clienteNombre(c).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{clienteNombre(c)}</p>
                  <p className={cn('text-[9px] font-medium',
                    c.dias_sin_contacto > 30 ? 'text-red-500' : c.dias_sin_contacto > 7 ? 'text-amber-500' : 'text-gray-400')}>
                    {c.dias_sin_contacto > 30 ? `⚠ ${c.dias_sin_contacto}d sin contacto` :
                     c.dias_sin_contacto > 7 ? `${c.dias_sin_contacto}d sin contacto` : 'Activo'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clientes VIP */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-yellow-500" />
              <span className="text-xs font-bold text-gray-700">Clientes VIP</span>
            </div>
            <button onClick={() => navigate('/clientes')} className="text-[9px] text-violet-500 font-semibold hover:underline">Ver todos</button>
          </div>
          <div className="p-3 space-y-2">
            {(data?.top_clientes ?? []).map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-0.5"
                onClick={() => navigate(`/clientes/${c.id}`)}>
                <span className="text-xs font-black text-gray-300 w-4 text-center">{i + 1}</span>
                <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center shrink-0 text-[9px] font-bold text-yellow-600">
                  {clienteNombre(c).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{clienteNombre(c)}</p>
                  <p className="text-[9px] text-gray-400">{c.operaciones_count} compras · {formatCurrency(Number(c.valor_total_historico))}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Embudo de ventas */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} className="text-violet-500" />
            <span className="text-xs font-bold text-gray-700">Embudo de ventas</span>
          </div>
          <div className="space-y-2">
            {(data?.embudo ?? []).map(e => (
              <div key={e.etapa}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-gray-500">{e.etapa}</span>
                  <span className="text-[10px] font-bold text-gray-700">{e.count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${e.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-3 text-right">
            Tasa conversión global: <strong>{kpis?.tasa_cierre ?? 0}%</strong>
          </p>
        </div>

        {/* Ventas por período */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-gray-700">Ventas por período</span>
            </div>
            <div>
              <p className="text-xs font-black text-gray-900 text-right">{formatCurrency(kpis?.facturacion_mes ?? 0)}</p>
              <VsBadge pct={kpis?.ventas_vs_anterior ?? 0} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data?.ventas_semanales ?? []} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="ventas" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Origen de leads + Productos consultados */}
        <div className="space-y-4">
          {/* Origen */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gift size={14} className="text-rose-500" />
              <span className="text-xs font-bold text-gray-700">Origen de leads</span>
            </div>
            {(data?.origen_leads ?? []).length === 0 ? (
              <p className="text-[10px] text-gray-300 text-center py-2">Sin datos</p>
            ) : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width={70} height={70}>
                  <PieChart>
                    <Pie data={data?.origen_leads.map((o, i) => ({ name: o.origen, value: o.cant, color: COLORES_PIE[i % COLORES_PIE.length] }))}
                      cx="50%" cy="50%" innerRadius={22} outerRadius={33} dataKey="value" paddingAngle={2}>
                      {(data?.origen_leads ?? []).map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {(data?.origen_leads ?? []).slice(0, 4).map((o, i) => (
                    <div key={o.origen} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORES_PIE[i % COLORES_PIE.length] }} />
                      <span className="text-[9px] text-gray-600 flex-1 capitalize truncate">{o.origen}</span>
                      <span className="text-[9px] font-bold text-gray-700">{Math.round(o.cant / (data?.origen_leads.reduce((s,x) => s+x.cant,0) || 1) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Productos consultados */}
          <div className="bg-white rounded-xl border border-gray-300 shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={14} className="text-sky-500" />
              <span className="text-xs font-bold text-gray-700">Productos consultados</span>
            </div>
            <div className="space-y-1.5">
              {(data?.productos_consultados ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-300 w-3">{i+1}</span>
                  <span className="text-[10px] text-gray-600 flex-1 truncate">{p.producto}</span>
                  <span className="text-[9px] text-violet-500 font-semibold">{p.presupuestos} pres.</span>
                </div>
              ))}
              {(data?.productos_consultados ?? []).length === 0 && (
                <p className="text-[10px] text-gray-300 text-center py-2">Sin datos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Oportunidades sin actividad ── */}
      <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-800">Oportunidades sin actividad</span>
          </div>
          <span className="text-[10px] text-gray-400">{data?.oportunidades_inactivas.length ?? 0} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Etapa</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Última actividad</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Días sin actividad</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Monto est.</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(data?.oportunidades_inactivas ?? []).length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-xs text-gray-400">Sin oportunidades inactivas</td></tr>
              ) : (data?.oportunidades_inactivas ?? []).map(o => {
                const cfg = ETAPA_CONFIG[o.crm_etapa] ?? ETAPA_CONFIG.nuevo;
                const diasColor = o.dias_sin_contacto > 28 ? 'text-red-500 bg-red-50' :
                  o.dias_sin_contacto > 14 ? 'text-amber-500 bg-amber-50' : 'text-gray-600 bg-gray-50';
                return (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/clientes/${o.id}`)}>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{clienteNombre(o)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {o.ultima_interaccion ? new Date(o.ultima_interaccion).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', diasColor)}>
                        {o.dias_sin_contacto === 999 ? 'Nunca' : `${o.dias_sin_contacto} días`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {o.monto_estimado ? formatCurrency(Number(o.monto_estimado)) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={e => { e.stopPropagation(); navigate(`/clientes/${o.id}`); }}
                        className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-lg">
                        Contactar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Presupuestos sin respuesta ── */}
      {(data?.presupuestos_sin_respuesta ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-300 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-800">Presupuestos sin respuesta</span>
            </div>
            <button onClick={() => navigate('/presupuestos')} className="text-[10px] text-violet-500 font-semibold hover:underline flex items-center gap-1">
              Ver todos <ChevronRight size={11} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Presupuesto</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sin respuesta</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(data?.presupuestos_sin_respuesta ?? []).map(p => (
                  <tr key={p.op_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{clienteNombre(p)}</td>
                    <td className="px-4 py-2.5 text-gray-500">#{p.numero}</td>
                    <td className="px-4 py-2.5 font-bold text-gray-700">{formatCurrency(Number(p.precio_total))}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                        p.dias_sin_respuesta > 14 ? 'bg-red-50 text-red-500' :
                        p.dias_sin_respuesta > 7 ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-600')}>
                        {p.dias_sin_respuesta} días
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.telefono && (
                        <a href={`https://wa.me/${p.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold rounded-lg w-fit">
                          <MessageCircle size={10} /> WhatsApp
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

export default CRM;
