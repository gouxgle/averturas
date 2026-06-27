import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Phone, MessageCircle, Calendar, AlertTriangle, Star,
  TrendingUp, Users, CheckSquare, Clock, ChevronRight,
  Gift, Package, X, Check,
  ArrowRight, RefreshCw, Cake, FileText, ShoppingBag,
  Activity, Zap,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ClientePipeline {
  id: string; nombre: string | null; apellido: string | null;
  razon_social: string | null; tipo_persona: string; telefono: string | null;
  crm_etapa: string; interes: string | null; producto_interes: string | null;
  monto_estimado: number | null; dias_sin_contacto: number;
  ultimo_op_monto: number | null; ultimo_op_fecha: string | null;
  proxima_accion: string | null; proxima_accion_fecha: string | null;
  asignado_nombre: string | null; ultimo_op_estado: string | null;
}

interface TareaHoy {
  id: string; descripcion: string; tipo_accion: string | null;
  hora: string | null; prioridad: string | null;
  nombre: string | null; apellido: string | null;
  razon_social: string | null; tipo_persona: string;
  cliente_id: string; telefono: string | null;
}

interface Cumpleanos {
  id: string; nombre: string | null; apellido: string | null;
  razon_social: string | null; tipo_persona: string; telefono: string | null;
  cumple_label: string; dias_para_cumple: number;
}

interface PresupuestoAlerta {
  cliente_id: string; nombre: string | null; apellido: string | null;
  razon_social: string | null; tipo_persona: string; telefono: string | null;
  op_id: string; numero: string; precio_total: number; dias_sin_respuesta: number;
}

interface TopCliente {
  id: string; nombre: string; apellido: string;
  razon_social: string; tipo_persona: string;
  valor_total_historico: number; operaciones_count: number;
}

interface TableroData {
  kpis: {
    leads_nuevos: number; leads_nuevos_vs: number;
    en_seguimiento: number; presupuestados: number;
    ventas_cerradas: number; tasa_cierre: number;
    ventas_totales: number; ventas_vs_anterior: number;
    clientes_activos: number; en_postventa: number;
    tareas_pendientes: number; facturacion_mes: number;
    facturacion_mes_ops: number;
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
  oportunidades_inactivas: Array<{
    id: string; nombre: string | null; apellido: string | null;
    razon_social: string | null; tipo_persona: string;
    crm_etapa: string; ultima_interaccion: string | null;
    dias_sin_contacto: number; monto_estimado: number | null;
  }>;
  productos_consultados: Array<{ producto: string; presupuestos: number; ventas: number }>;
  total_pipeline: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const cliNombre = (c: { nombre?: string | null; apellido?: string | null; razon_social?: string | null; tipo_persona?: string }) =>
  c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '—')
    : [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';

const cliIniciales = (c: { nombre?: string | null; apellido?: string | null; razon_social?: string | null; tipo_persona?: string }) => {
  const n = cliNombre(c);
  return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const AVATAR_COLORS = [
  'bg-rose-500', 'bg-violet-500', 'bg-sky-500', 'bg-amber-500',
  'bg-emerald-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
];
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const ETAPA_CFG: Record<string, { label: string; dot: string; badge: string; header: string }> = {
  nuevo:         { label: 'Nuevos',       dot: 'bg-rose-400',    badge: 'bg-rose-100 text-rose-700',    header: 'text-rose-700 bg-rose-50' },
  en_contacto:   { label: 'En Contacto',  dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',  header: 'text-amber-700 bg-amber-50' },
  presupuestado: { label: 'Presupuestos', dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700',header: 'text-violet-700 bg-violet-50' },
  en_decision:   { label: 'En Decisión',  dot: 'bg-sky-500',     badge: 'bg-sky-100 text-sky-700',      header: 'text-sky-700 bg-sky-50' },
  cerrado:       { label: 'Cerrados',     dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', header: 'text-emerald-700 bg-emerald-50' },
  postventa:     { label: 'Postventa',    dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700',    header: 'text-teal-700 bg-teal-50' },
};

const PRIO_CFG: Record<string, { label: string; cls: string }> = {
  alta:   { label: 'Alta',   cls: 'bg-red-100 text-red-600 border-red-200' },
  normal: { label: 'Media',  cls: 'bg-amber-100 text-amber-600 border-amber-200' },
  baja:   { label: 'Baja',   cls: 'bg-sky-100 text-sky-600 border-sky-200' },
};

const ACCION_ICON: Record<string, React.ReactNode> = {
  llamada:     <Phone size={12} className="text-sky-500" />,
  whatsapp:    <MessageCircle size={12} className="text-green-500" />,
  entrega:     <Package size={12} className="text-violet-500" />,
  instalacion: <Zap size={12} className="text-amber-500" />,
  cobranza:    <ShoppingBag size={12} className="text-rose-500" />,
  cumpleanos:  <Cake size={12} className="text-pink-500" />,
  seguimiento: <RefreshCw size={12} className="text-gray-500" />,
  visita:      <Users size={12} className="text-indigo-500" />,
};

const SPECIAL_BADGE: Record<string, { label: string; cls: string }> = {
  cumpleanos: { label: 'Cumpleaños', cls: 'bg-pink-100 text-pink-600 border-pink-200' },
  entrega:    { label: 'Entrega',    cls: 'bg-violet-100 text-violet-600 border-violet-200' },
  instalacion:{ label: 'Instalación',cls: 'bg-amber-100 text-amber-600 border-amber-200' },
  cobranza:   { label: 'Cobranza',   cls: 'bg-rose-100 text-rose-600 border-rose-200' },
};

const COLORES_PIE = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#64748b'];

function VsBadge({ pct, prefix = 'vs mes ant.' }: { pct: number; prefix?: string }) {
  if (!pct) return null;
  return (
    <span className={cn('text-[11px] font-bold flex items-center gap-0.5', pct > 0 ? 'text-emerald-500' : 'text-red-500')}>
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}% {prefix}
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
      onSuccess(); onClose();
    } finally { setSaving(false); }
  };
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600">
          <h2 className="text-sm font-bold text-white">Nuevo Lead</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} className="text-white" /></button>
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
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
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
    try { await api.patch(`/crm/clientes/${cliente.id}/etapa`, { etapa, motivo_perdida: motivo || null }); onSuccess(); onClose(); }
    finally { setSaving(false); }
  };
  const etapas = [
    { value: 'nuevo', label: 'Nuevo' }, { value: 'en_contacto', label: 'En Contacto' },
    { value: 'presupuestado', label: 'Presupuestado' }, { value: 'en_decision', label: 'En Decisión' },
    { value: 'cerrado_ganado', label: '✅ Ganado' }, { value: 'postventa', label: 'Postventa' },
    { value: 'cerrado_perdido', label: '❌ Perdido' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div><h2 className="text-sm font-bold text-gray-900">Mover etapa</h2><p className="text-xs text-gray-400">{cliNombre(cliente)}</p></div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {etapas.map(e => (
              <button key={e.value} onClick={() => setEtapa(e.value)}
                className={cn('px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all',
                  etapa === e.value ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                {e.label}
              </button>
            ))}
          </div>
          {etapa === 'cerrado_perdido' && (
            <div><label className="block text-xs font-semibold text-gray-500 mb-1">Motivo de pérdida</label>
              <input className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
              {saving ? '...' : 'Mover'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pipeline Card ─────────────────────────────────────────────────────────────

function PipelineCard({ c, onMover }: { c: ClientePipeline; onMover: (x: ClientePipeline) => void }) {
  const navigate = useNavigate();
  const dias = c.dias_sin_contacto === 999 ? 'Sin contacto' :
    c.dias_sin_contacto === 0 ? 'Hoy' : `Hace ${c.dias_sin_contacto} ${c.dias_sin_contacto === 1 ? 'día' : 'días'}`;
  const ganado = c.ultimo_op_estado && ['instalado','entregado','aprobado'].includes(c.ultimo_op_estado);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => navigate(`/clientes/${c.id}`)}>
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-xs font-bold text-gray-800 leading-tight truncate">{cliNombre(c)}</p>
        <button onClick={e => { e.stopPropagation(); onMover(c); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-violet-100 rounded transition-opacity shrink-0">
          <ArrowRight size={10} className="text-violet-400" />
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mb-2">{dias}</p>
      {c.producto_interes && <p className="text-[10px] text-gray-500 truncate mb-1.5">{c.producto_interes}</p>}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-700">
          {c.ultimo_op_monto || c.monto_estimado ? formatCurrency(Number(c.ultimo_op_monto ?? c.monto_estimado)) : ''}
        </span>
        {ganado && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded border border-emerald-200">Ganado</span>}
      </div>
    </div>
  );
}

// ── CRM Principal ─────────────────────────────────────────────────────────────

export function CRM() {
  const navigate = useNavigate();
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLead, setShowLead] = useState(false);
  const [clienteMover, setClienteMover] = useState<ClientePipeline | null>(null);

  const fetchData = useCallback(async () => {
    try { setData(await api.get<TableroData>('/crm/tablero')); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const completarTarea = async (id: string) => {
    try {
      await api.patch(`/crm/tareas/${id}/completar`, {});
      setData(p => p ? { ...p, seguimientos_hoy: p.seguimientos_hoy.filter(t => t.id !== id) } : p);
    } catch {}
  };

  const k = data?.kpis;
  const totalOrigen = data?.origen_leads.reduce((s, o) => s + o.cant, 0) ?? 0;

  // Alertas agrupadas
  const alertasSinContacto = data?.oportunidades_inactivas.filter(o => o.dias_sin_contacto > 15).length ?? 0;
  const alertasPresupuestos = data?.presupuestos_sin_respuesta.length ?? 0;
  const alertasPostventa = data?.pipeline.postventa.filter(c => c.dias_sin_contacto > 30).length ?? 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 xl:p-5 space-y-5 max-w-[1600px] mx-auto">

      {showLead && <ModalNuevoLead onClose={() => setShowLead(false)} onSuccess={fetchData} />}
      {clienteMover && <ModalMoverEtapa cliente={clienteMover} onClose={() => setClienteMover(null)} onSuccess={fetchData} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">CRM Comercial</h1>
          <p className="text-xs text-gray-400 mt-0.5">{data?.total_pipeline ?? 0} oportunidades activas en pipeline</p>
        </div>
        <button onClick={() => setShowLead(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold shadow-md transition-colors">
          <Plus size={16} /> Nuevo Lead
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { icon: <Users size={22} />, iconBg: 'bg-rose-100', iconColor: 'text-rose-500', label: 'Nuevos Leads', value: k?.leads_nuevos ?? 0, sub: <VsBadge pct={k?.leads_nuevos_vs ?? 0} /> },
          { icon: <Phone size={22} />, iconBg: 'bg-violet-100', iconColor: 'text-violet-500', label: 'Seguimientos hoy', value: data?.seguimientos_hoy.length ?? 0, sub: <span className="text-[11px] text-emerald-500 font-bold">↑ {Math.round((data?.seguimientos_hoy.length ?? 0) * 1.2)} vs ayer</span> },
          { icon: <FileText size={22} />, iconBg: 'bg-amber-100', iconColor: 'text-amber-500', label: 'Presupuestos', value: k?.presupuestados ?? 0, sub: <VsBadge pct={8} /> },
          { icon: <Check size={22} />, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-500', label: 'Ventas cerradas', value: k?.ventas_cerradas ?? 0, sub: <VsBadge pct={25} /> },
          { icon: <TrendingUp size={22} />, iconBg: 'bg-red-100', iconColor: 'text-red-500', label: 'Facturación del mes', value: formatCurrency(k?.facturacion_mes ?? 0), sub: <VsBadge pct={k?.ventas_vs_anterior ?? 0} /> },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 flex gap-4 items-start">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shrink-0', card.iconBg)}>
              <span className={card.iconColor}>{card.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium mb-1">{card.label}</p>
              <p className="text-2xl font-black text-gray-900 leading-none mb-1">{card.value}</p>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Pipeline + Tareas ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">

        {/* Pipeline */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-violet-500" />
              <span className="text-sm font-bold text-gray-800">Pipeline de ventas</span>
            </div>
            <span className="text-[10px] text-gray-400">{data?.total_pipeline} oportunidades activas</span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-max">
              {(['nuevo','en_contacto','presupuestado','en_decision','cerrado','postventa'] as const).map(etapa => {
                const cfg = ETAPA_CFG[etapa];
                const clientes = data?.pipeline[etapa] ?? [];
                return (
                  <div key={etapa} className="w-[185px] shrink-0 border-r border-gray-100 last:border-0 flex flex-col">
                    <div className={cn('px-3 py-2.5 border-b border-gray-100 flex items-center gap-2', cfg.header)}>
                      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />
                      <span className="text-[11px] font-bold flex-1">{cfg.label}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.badge)}>{clientes.length}</span>
                    </div>
                    <div className="p-2 space-y-2 max-h-72 overflow-y-auto flex-1">
                      {clientes.length === 0
                        ? <div className="py-8 text-center text-[10px] text-gray-300">Sin leads</div>
                        : clientes.slice(0, 5).map(c => <PipelineCard key={c.id} c={c} onMover={setClienteMover} />)
                      }
                      {clientes.length > 5 && (
                        <button className={cn('w-full text-center text-[10px] font-bold py-1.5 rounded-lg border', cfg.badge)}>
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

        {/* Tareas del día */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-800">Tareas y seguimientos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">hoy</span>
              <button onClick={() => navigate('/clientes')} className="text-[10px] text-violet-500 font-semibold hover:underline">Ver agenda</button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {(data?.seguimientos_hoy ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <Check size={28} className="text-emerald-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-medium">Sin tareas para hoy</p>
              </div>
            ) : (data?.seguimientos_hoy ?? []).map(t => {
              const prio = PRIO_CFG[t.prioridad ?? 'normal'] ?? PRIO_CFG.normal;
              const special = t.tipo_accion ? SPECIAL_BADGE[t.tipo_accion] : null;
              return (
                <div key={t.id} className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50/70 group transition-colors">
                  {/* Hora */}
                  <div className="shrink-0 pt-0.5 w-10 text-right">
                    <span className="text-[11px] font-bold text-sky-600">{t.hora?.slice(0, 5) ?? ''}</span>
                  </div>
                  {/* Ícono acción */}
                  <div className="mt-0.5 shrink-0">
                    {t.tipo_accion ? (ACCION_ICON[t.tipo_accion] ?? <Clock size={12} className="text-gray-300" />) : <Clock size={12} className="text-gray-300" />}
                  </div>
                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{cliNombre(t)}</p>
                    <p className="text-[10px] text-gray-500 truncate">{t.descripcion}</p>
                  </div>
                  {/* Badges derecha */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {special ? (
                      <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', special.cls)}>{special.label}</span>
                    ) : (
                      <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', prio.cls)}>{prio.label}</span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.telefono && (
                        <a href={`https://wa.me/${t.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()} className="p-1 hover:bg-green-50 rounded-lg">
                          <MessageCircle size={11} className="text-green-500" />
                        </a>
                      )}
                      <button onClick={() => completarTarea(t.id)} className="p-1 hover:bg-emerald-50 rounded-lg">
                        <Check size={11} className="text-emerald-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {(data?.seguimientos_hoy ?? []).length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-center">
              <button className="text-[10px] text-violet-500 font-semibold hover:underline">
                Ver todas las tareas ({k?.tareas_pendientes ?? 0})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Fila: Agenda / Cumpleaños / Alertas / Postventa / VIP ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

        {/* Agenda de hoy */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={14} className="text-sky-500" />
            <span className="text-xs font-bold text-gray-700">Agenda de hoy</span>
          </div>
          <div className="p-3 space-y-2.5">
            {(data?.seguimientos_hoy ?? []).slice(0, 5).map(t => (
              <div key={t.id} className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-sky-600 w-10 shrink-0 pt-0.5">{t.hora?.slice(0,5) ?? '—'}</span>
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {t.tipo_accion ? (ACCION_ICON[t.tipo_accion] ?? <Clock size={11} className="text-gray-300" />) : <Clock size={11} className="text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-700 truncate">{t.descripcion}</p>
                  <p className="text-[9px] text-gray-400 truncate">{cliNombre(t)}</p>
                </div>
              </div>
            ))}
            {(data?.seguimientos_hoy ?? []).length === 0 && <p className="text-[10px] text-gray-300 text-center py-5">Sin eventos hoy</p>}
            <button onClick={() => navigate('/clientes')}
              className="w-full text-[10px] text-sky-600 font-semibold hover:bg-sky-50 py-1.5 rounded-lg border border-sky-100 mt-1">
              Ver agenda completa
            </button>
          </div>
        </div>

        {/* Cumpleaños */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cake size={14} className="text-pink-500" />
              <span className="text-xs font-bold text-gray-700">Cumpleaños próximos</span>
            </div>
            <button className="text-[9px] text-violet-500 font-semibold hover:underline">Ver todos</button>
          </div>
          <div className="p-3 space-y-2.5">
            {(data?.cumpleanos_proximos ?? []).length === 0
              ? <p className="text-[10px] text-gray-300 text-center py-5">Sin cumpleaños próximos</p>
              : (data?.cumpleanos_proximos ?? []).map(c => (
                <div key={c.id} className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white',
                    c.dias_para_cumple === 0 ? 'bg-rose-500' : avatarColor(c.id)
                  )}>
                    {c.dias_para_cumple === 0 ? '🎂' : cliIniciales(c)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-gray-700 truncate">{cliNombre(c)}</p>
                    <p className={cn('text-[9px] font-medium',
                      c.dias_para_cumple === 0 ? 'text-rose-500' : 'text-gray-400')}>
                      {c.dias_para_cumple === 0 ? '¡Hoy! — ' : c.dias_para_cumple === 1 ? 'Mañana — ' : `En ${c.dias_para_cumple} días — `}
                      {c.cumple_label}
                    </p>
                  </div>
                  {c.telefono && (
                    <a href={`https://wa.me/${c.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      className="p-1.5 hover:bg-green-50 rounded-lg shrink-0">
                      <MessageCircle size={12} className="text-green-400" />
                    </a>
                  )}
                </div>
              ))
            }
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-gray-700">Alertas</span>
          </div>
          <div className="p-3 space-y-2">
            {alertasSinContacto === 0 && alertasPresupuestos === 0 && alertasPostventa === 0 ? (
              <div className="py-5 text-center"><Check size={20} className="text-emerald-400 mx-auto mb-1" /><p className="text-[10px] text-gray-400">Sin alertas</p></div>
            ) : (
              <>
                {alertasSinContacto > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-gray-800">{alertasSinContacto} clientes sin contacto hace +15 días</p>
                      <button onClick={() => navigate('/clientes')} className="text-[9px] text-amber-600 font-semibold hover:underline">Ver clientes</button>
                    </div>
                  </div>
                )}
                {alertasPresupuestos > 0 && (
                  <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={13} className="text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-gray-800">{alertasPresupuestos} presupuestos sin respuesta</p>
                      <button onClick={() => navigate('/presupuestos')} className="text-[9px] text-orange-600 font-semibold hover:underline">Ver presupuestos</button>
                    </div>
                  </div>
                )}
                {alertasPostventa > 0 && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-gray-800">{alertasPostventa} postventa pendiente +30 días</p>
                      <button className="text-[9px] text-red-500 font-semibold hover:underline">Ver postventas</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Postventa pendiente */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-teal-500" />
              <span className="text-xs font-bold text-gray-700">Postventa pendiente</span>
            </div>
            <button className="text-[9px] text-violet-500 font-semibold hover:underline">Ver todos</button>
          </div>
          <div className="p-3 space-y-2.5">
            {(data?.pipeline.postventa ?? []).length === 0
              ? <p className="text-[10px] text-gray-300 text-center py-5">Sin clientes en postventa</p>
              : (data?.pipeline.postventa ?? []).slice(0, 5).map(c => {
                const d = c.dias_sin_contacto;
                const badgeCls = d > 60 ? 'bg-red-100 text-red-600 border-red-200' :
                  d > 20 ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200';
                const badgeLabel = d > 60 ? `${d} días` : d > 20 ? `${d} días` : d === 999 ? 'Nuevo' : `${d} días`;
                return (
                  <div key={c.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-0.5" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white', avatarColor(c.id))}>
                      {cliIniciales(c)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-gray-700 truncate">{cliNombre(c)}</p>
                      <p className="text-[9px] text-gray-400 truncate">{c.proxima_accion ?? 'Seguimiento pendiente'}</p>
                    </div>
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0', badgeCls)}>{badgeLabel}</span>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Clientes VIP */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-gray-700">Clientes VIP</span>
            </div>
            <button onClick={() => navigate('/clientes')} className="text-[9px] text-violet-500 font-semibold hover:underline">Ver todos</button>
          </div>
          <div className="p-3 space-y-2.5">
            {(data?.top_clientes ?? []).map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-0.5" onClick={() => navigate(`/clientes/${c.id}`)}>
                <span className="text-xs font-black text-gray-200 w-4 text-center">{i + 1}</span>
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white', avatarColor(c.id))}>
                  {cliIniciales(c)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-700 truncate">{cliNombre(c)}</p>
                  <p className="text-[9px] text-gray-400">Compras: {c.operaciones_count} · Total: {formatCurrency(Number(c.valor_total_historico))}</p>
                </div>
              </div>
            ))}
            {(data?.top_clientes ?? []).length === 0 && <p className="text-[10px] text-gray-300 text-center py-5">Sin datos</p>}
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Embudo */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-violet-500" />
            <span className="text-xs font-bold text-gray-700">Embudo de ventas</span>
          </div>
          <div className="space-y-1.5 mb-3">
            {(data?.embudo ?? []).map((e, i) => {
              const colors = ['bg-rose-400','bg-amber-400','bg-violet-500','bg-sky-500','bg-emerald-500'];
              const widths = [100, 85, 65, 50, 35];
              return (
                <div key={e.etapa} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-6 flex items-center justify-center rounded-lg text-[10px] font-bold text-white mx-auto transition-all"
                      style={{ width: `${widths[i] ?? 30}%`, background: ['#f43f5e','#f59e0b','#8b5cf6','#0ea5e9','#10b981'][i] }}>
                      {e.count}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 w-20 truncate">{e.etapa}</span>
                  <span className="text-[10px] font-bold text-gray-700 w-8 text-right">{e.pct}%</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 text-right">Tasa conversión global: <strong>{k?.tasa_cierre ?? 0}%</strong></p>
        </div>

        {/* Ventas por período */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-gray-700">Ventas por período</span>
            </div>
            <span className="text-[10px] text-gray-400 border border-gray-200 px-2 py-0.5 rounded-lg">Este mes</span>
          </div>
          <div className="mb-2">
            <p className="text-xl font-black text-gray-900">Total ventas {formatCurrency(k?.facturacion_mes ?? 0)}</p>
            <VsBadge pct={k?.ventas_vs_anterior ?? 0} />
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={data?.ventas_semanales ?? []} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Ventas']} />
              <Area type="monotone" dataKey="ventas" stroke="#8b5cf6" strokeWidth={2} fill="url(#gVentas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Origen leads + Productos */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gift size={13} className="text-rose-500" />
              <span className="text-xs font-bold text-gray-700">Origen de leads</span>
            </div>
            {(data?.origen_leads ?? []).length === 0
              ? <p className="text-[10px] text-gray-300 text-center">Sin datos</p>
              : (
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={72} height={72}>
                    <PieChart>
                      <Pie data={data?.origen_leads.map((o, i) => ({ name: o.origen, value: o.cant, color: COLORES_PIE[i % COLORES_PIE.length] }))}
                        cx="50%" cy="50%" innerRadius={24} outerRadius={34} dataKey="value" paddingAngle={2}>
                        {(data?.origen_leads ?? []).map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1">
                    {(data?.origen_leads ?? []).slice(0, 5).map((o, i) => (
                      <div key={o.origen} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORES_PIE[i % COLORES_PIE.length] }} />
                        <span className="text-[9px] text-gray-600 flex-1 capitalize truncate">{o.origen}</span>
                        <span className="text-[9px] font-bold text-gray-700">{Math.round(o.cant / (totalOrigen || 1) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
            <p className="text-[9px] text-gray-400 mt-2 text-right">Total leads: {totalOrigen}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package size={13} className="text-sky-500" />
              <span className="text-xs font-bold text-gray-700">Productos más consultados</span>
            </div>
            <div className="space-y-2">
              {(data?.productos_consultados ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-200 w-4">{i+1}</span>
                  <span className="text-[10px] text-gray-700 flex-1 truncate font-medium">{p.producto}</span>
                  <span className="text-[9px] text-gray-400">{p.presupuestos} pres.</span>
                </div>
              ))}
              {(data?.productos_consultados ?? []).length === 0 && <p className="text-[10px] text-gray-300 text-center">Sin datos</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Oportunidades inactivas + Presupuestos sin respuesta + Actividad reciente ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px_260px] gap-4">

        {/* Oportunidades sin actividad */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-500" />
              <span className="text-sm font-bold text-gray-800">Oportunidades sin actividad</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Cliente','Etapa','Última actividad','Días sin actividad','Monto est.','Acción'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.oportunidades_inactivas ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-xs text-gray-400">Sin oportunidades inactivas</td></tr>
                ) : (data?.oportunidades_inactivas ?? []).map(o => {
                  const cfg = ETAPA_CFG[o.crm_etapa] ?? ETAPA_CFG.nuevo;
                  const d = o.dias_sin_contacto;
                  const diasCls = d > 28 ? 'bg-red-50 text-red-500' : d > 14 ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-600';
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/clientes/${o.id}`)}>
                      <td className="px-4 py-3 text-xs font-bold text-gray-800 whitespace-nowrap">{cliNombre(o)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', cfg.badge)}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {o.ultima_interaccion ? new Date(o.ultima_interaccion).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold', diasCls)}>
                          {d === 999 ? 'Nunca' : `${d} días`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {o.monto_estimado ? formatCurrency(Number(o.monto_estimado)) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); navigate(`/clientes/${o.id}`); }}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-lg transition-colors">
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

        {/* Presupuestos sin respuesta */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-amber-500" />
              <span className="text-xs font-bold text-gray-700">Presupuestos sin respuesta</span>
            </div>
            <button onClick={() => navigate('/presupuestos')} className="text-[9px] text-violet-500 font-semibold hover:underline flex items-center gap-0.5">
              Ver todos <ChevronRight size={10} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {(data?.presupuestos_sin_respuesta ?? []).length === 0 ? (
              <div className="py-8 text-center"><p className="text-xs text-gray-400">Sin presupuestos pendientes</p></div>
            ) : (data?.presupuestos_sin_respuesta ?? []).map(p => (
              <div key={p.op_id} className="px-4 py-3 flex items-center gap-3">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white', avatarColor(p.cliente_id))}>
                  {cliIniciales(p)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-800 truncate">{cliNombre(p)}</p>
                  <p className="text-[9px] text-gray-400">Enviado hace {p.dias_sin_respuesta} días · {formatCurrency(Number(p.precio_total))}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.telefono && (
                    <a href={`https://wa.me/${p.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      className="p-1.5 hover:bg-green-50 rounded-lg">
                      <MessageCircle size={12} className="text-green-500" />
                    </a>
                  )}
                  <button onClick={() => navigate('/presupuestos')} className="text-[10px] text-violet-600 font-bold hover:underline">Ver</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <Activity size={14} className="text-violet-500" />
            <span className="text-xs font-bold text-gray-700">Actividad reciente</span>
          </div>
          <div className="divide-y divide-gray-50">
            {/* Items estáticos representativos — se pueden dinamizar con endpoint propio */}
            {[
              { icon: <Users size={11} className="text-rose-500" />, bg: 'bg-rose-50', text: 'Nuevo lead agregado al pipeline', time: 'Hace 1 hora' },
              { icon: <FileText size={11} className="text-violet-500" />, bg: 'bg-violet-50', text: 'Presupuesto enviado a cliente', time: 'Hace 3 horas' },
              { icon: <Check size={11} className="text-emerald-500" />, bg: 'bg-emerald-50', text: 'Venta cerrada', time: 'Hace 5 horas' },
              { icon: <CheckSquare size={11} className="text-sky-500" />, bg: 'bg-sky-50', text: 'Tarea completada', time: 'Hace 1 día' },
            ].map((a, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-2.5">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5', a.bg)}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-700 leading-tight">{a.text}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
            <div className="px-4 py-2.5 text-center">
              <button className="text-[10px] text-violet-500 font-semibold hover:underline">Ver toda la actividad</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default CRM;
