import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Hammer, Plus, AlertTriangle, Clock, CheckCircle2, XCircle,
  Truck, Package, ChevronRight, Eye, Phone, MessageCircle,
  CalendarClock, BarChart3, Zap, PrinterIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ── Tipos ────────────────────────────────────────────────────────────

interface TStats {
  total: number; valor_total: number;
  en_produccion: number; valor_produccion: number;
  listos: number; valor_listos: number;
  atrasadas: number; valor_atrasadas: number;
  entregadas_semana: number; valor_entregadas_semana: number;
}

interface TOp {
  id: string; numero: string; estado: string; tipo: string;
  precio_total: number; margen: number;
  created_at: string; fecha_entrega_estimada: string | null;
  tiempo_entrega: number | null; updated_at: string; dias_en_estado: number;
  primer_item: string | null; medidas: string | null;
  cliente: { id: string; nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string; telefono: string | null };
}

interface TProxima {
  id: string; numero: string; precio_total: number; estado: string;
  fecha_entrega_estimada: string;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

interface TableroData {
  stats: TStats;
  kanban: { confirmado: TOp[]; en_produccion: TOp[]; listo: TOp[]; entregado: TOp[]; cancelado: TOp[] };
  proximas: TProxima[];
  detalle: TOp[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function ncl(c: TOp['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function nclProxima(c: TProxima['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function diasHasta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
}

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function VenceBadge({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-gray-400 text-xs">—</span>;
  const dias = diasHasta(iso);
  if (dias === null) return <span className="text-gray-400 text-xs">—</span>;
  if (dias < 0) return <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Atrasado</span>;
  if (dias === 0) return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Hoy</span>;
  if (dias === 1) return <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Mañana</span>;
  if (dias <= 3) return <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">En {dias} días</span>;
  return <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">En {dias} días</span>;
}

const TIPO_LABEL: Record<string, string> = {
  estandar: 'Estándar', a_medida_proveedor: 'A medida', fabricacion_propia: 'Fab. propia',
};

// ── Sub-componentes ──────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, iconBg, iconCl, subCl = 'text-gray-400' }: {
  icon: React.ElementType; label: string; value: string | number; sub: string;
  iconBg: string; iconCl: string; subCl?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-medium text-gray-500 leading-tight">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={16} className={iconCl} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-gray-900 tabular-nums leading-none">{value}</p>
      <p className={`text-[11px] mt-1 ${subCl}`}>{sub}</p>
    </div>
  );
}

function AlertChip({ icon: Icon, count, label, sub, color }: {
  icon: React.ElementType; count: number; label: string; sub: string; color: string;
}) {
  const cls = {
    red:    { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',    icon: 'text-red-500' },
    amber:  { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  icon: 'text-amber-500' },
    orange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  }[color] ?? { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', icon: 'text-gray-500' };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cls.bg}`}>
      <Icon size={18} className={cls.icon} />
      <div>
        <p className={`text-sm font-bold ${cls.text}`}>
          <span className="text-lg mr-1">{count}</span>{label}
        </p>
        <p className="text-[11px] text-gray-500">{sub}</p>
      </div>
    </div>
  );
}

// Tarjeta de kanban
function KCard({ op, onEstado }: { op: TOp; onEstado: (id: string, est: string) => void }) {
  const navigate = useNavigate();
  const atrasado = op.fecha_entrega_estimada ? diasHasta(op.fecha_entrega_estimada)! < 0 : false;
  const progPct = op.tiempo_entrega && op.dias_en_estado
    ? Math.min(Math.round((op.dias_en_estado / op.tiempo_entrega) * 100), 100)
    : null;

  return (
    <div
      className={cn(
        'bg-white border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all text-left',
        atrasado && op.estado !== 'entregado' && op.estado !== 'cancelado'
          ? 'border-red-200 bg-red-50/30'
          : 'border-gray-100',
      )}
      onClick={() => navigate(`/operaciones/${op.id}`)}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="text-[11px] font-mono font-bold text-blue-600">{op.numero}</span>
        {op.estado === 'en_produccion' && op.dias_en_estado > 0 && (
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
            op.dias_en_estado > 14 ? 'bg-red-100 text-red-700' : op.dias_en_estado > 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          )}>
            {op.dias_en_estado} días
          </span>
        )}
        {op.estado === 'listo' && (
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
            op.dias_en_estado > 3 ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
          )}>
            {op.dias_en_estado === 0 ? 'Hoy' : `${op.dias_en_estado}d`}
          </span>
        )}
        {op.estado === 'entregado' && (
          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
        )}
        {op.estado === 'cancelado' && (
          <XCircle size={14} className="text-red-400 shrink-0" />
        )}
      </div>

      <p className="text-[12px] font-semibold text-gray-800 truncate">{ncl(op.cliente)}</p>

      {op.estado === 'listo' && op.fecha_entrega_estimada && (
        <p className="text-[10px] text-gray-400 mt-0.5">Listo desde {fmtFecha(op.updated_at)}</p>
      )}
      {op.estado === 'en_produccion' && op.created_at && (
        <p className="text-[10px] text-gray-400 mt-0.5">Inició {fmtFecha(op.created_at)}</p>
      )}
      {(op.estado === 'aprobado') && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          {fmtFecha(op.created_at)} · <span className="text-violet-600">{TIPO_LABEL[op.tipo] ?? op.tipo}</span>
        </p>
      )}
      {(op.estado === 'entregado' || op.estado === 'cancelado') && (
        <p className="text-[10px] text-gray-400 mt-0.5">{fmtFecha(op.updated_at)}</p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <p className="text-[13px] font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(op.precio_total))}</p>
        {atrasado && op.estado !== 'entregado' && op.estado !== 'cancelado' && (
          <span className="text-[10px] font-bold text-red-600">Atrasado</span>
        )}
      </div>

      {/* Progress bar para en_produccion */}
      {op.estado === 'en_produccion' && progPct !== null && (
        <div className="mt-2">
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${progPct > 90 ? 'bg-red-500' : progPct > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${progPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">{progPct}%</p>
        </div>
      )}

      {/* Quick action buttons */}
      {(op.estado === 'en_produccion' || op.estado === 'aprobado') && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEstado(op.id, op.estado === 'aprobado' ? 'en_produccion' : 'listo'); }}
          className="mt-2 w-full text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg py-1 transition-colors"
        >
          {op.estado === 'aprobado' ? 'Iniciar producción →' : 'Marcar como listo →'}
        </button>
      )}
      {op.estado === 'listo' && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEstado(op.id, 'entregado'); }}
          className="mt-2 w-full text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg py-1 transition-colors"
        >
          Marcar como entregado →
        </button>
      )}
    </div>
  );
}

const COL_SHOW = 3;

function KCol({ title, color, ops, onEstado }: {
  title: string; color: string; ops: TOp[]; onEstado: (id: string, est: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ops : ops.slice(0, COL_SHOW);
  const cls = {
    green:  { header: 'border-emerald-400 text-emerald-700 bg-emerald-50', badge: 'bg-emerald-500' },
    amber:  { header: 'border-amber-400 text-amber-700 bg-amber-50',       badge: 'bg-amber-500' },
    teal:   { header: 'border-teal-400 text-teal-700 bg-teal-50',          badge: 'bg-teal-500' },
    blue:   { header: 'border-blue-400 text-blue-700 bg-blue-50',          badge: 'bg-blue-500' },
    red:    { header: 'border-red-300 text-red-600 bg-red-50',             badge: 'bg-red-400' },
  }[color] ?? { header: 'border-gray-300 text-gray-700 bg-gray-50', badge: 'bg-gray-400' };

  return (
    <div className="flex-1 min-w-[175px] max-w-[240px]">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border-l-4 mb-2 ${cls.header}`}>
        <p className="text-[12px] font-bold truncate">{title}</p>
        <span className={`text-[10px] font-extrabold text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${cls.badge}`}>
          {ops.length}
        </span>
      </div>
      <div className="space-y-2">
        {visible.map(op => <KCard key={op.id} op={op} onEstado={onEstado} />)}
      </div>
      {ops.length > COL_SHOW && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-[11px] font-semibold text-blue-600 hover:text-blue-700 py-1.5"
        >
          {expanded ? '↑ Mostrar menos' : `+ Ver todas (${ops.length})`}
        </button>
      )}
    </div>
  );
}

function DonutChart({ a: enP, b: listo, c: pend }: { a: number; b: number; c: number }) {
  const total = enP + listo + pend || 1;
  const r = 28; const cx = 36; const cy = 36;
  const circ = 2 * Math.PI * r;
  const segs = [
    { v: enP,  color: '#f59e0b' },
    { v: listo, color: '#10b981' },
    { v: pend,  color: '#f97316' },
  ].filter(s => s.v > 0);
  let off = 0;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
      {segs.map((seg, i) => {
        const pct = seg.v / total;
        const dash = pct * circ;
        const rot = off * 360 - 90;
        off += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ - dash}`}
            transform={`rotate(${rot} ${cx} ${cy})`} />
        );
      })}
    </svg>
  );
}

// ── Componente principal ─────────────────────────────────────────────

type Filtro = 'todas' | 'atrasadas' | 'por_vencer' | 'hoy';

export function Operaciones() {
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const load = useCallback(async () => {
    try {
      const d = await api.get<TableroData>('/operaciones/tablero');
      setData(d);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEstado = useCallback(async (id: string, estado: string) => {
    await api.patch(`/operaciones/${id}/estado`, { estado });
    load();
  }, [load]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  const detalleFiltrado = useMemo(() => {
    if (!data) return [];
    const ops = data.detalle;
    switch (filtro) {
      case 'atrasadas':
        return ops.filter(o => !['entregado', 'cancelado'].includes(o.estado) && diasHasta(o.fecha_entrega_estimada)! < 0);
      case 'hoy':
        return ops.filter(o => o.fecha_entrega_estimada?.slice(0, 10) === todayStr);
      case 'por_vencer':
        return ops.filter(o => {
          const d = diasHasta(o.fecha_entrega_estimada);
          return d !== null && d >= 0 && d <= 3 && !['entregado', 'cancelado'].includes(o.estado);
        });
      default:
        return ops;
    }
  }, [data, filtro, todayStr]);

  const cntAtrasadas  = data?.detalle.filter(o => !['entregado','cancelado'].includes(o.estado) && diasHasta(o.fecha_entrega_estimada)! < 0).length ?? 0;
  const cntPorVencer  = data?.detalle.filter(o => { const d = diasHasta(o.fecha_entrega_estimada); return d !== null && d >= 0 && d <= 3 && !['entregado','cancelado'].includes(o.estado); }).length ?? 0;
  const cntHoy        = data?.detalle.filter(o => o.fecha_entrega_estimada?.slice(0,10) === todayStr).length ?? 0;
  const cntListasNoEnt = data?.kanban.listo.length ?? 0;
  const cntPorVencerHoy = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0,10) === todayStr).length ?? 0;

  // Sidebar: agrupar próximas entregas
  const proximasHoy      = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0,10) === todayStr) ?? [];
  const proximasMañana   = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0,10) === tomorrowStr) ?? [];
  const proximasSemana   = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0,10) > tomorrowStr) ?? [];

  const maxCupos = 16;
  const cuposUsados = data?.stats.en_produccion ?? 0;
  const capacidadPct = Math.min(Math.round((cuposUsados / maxCupos) * 100), 100);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-4">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
            <Hammer size={22} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Operaciones</h1>
            <p className="text-sm text-gray-500 mt-0.5">Seguimiento de producción y entregas</p>
            <p className="text-xs text-gray-400">Controlá cada etapa y cumplí con tus clientes a tiempo.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            Filtros
          </button>
          <Link
            to="/operaciones/nueva"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all hover:opacity-90"
            style={{ background: '#f97316' }}
          >
            <Plus size={16} /> Nueva operación
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            {[80, 100, 300, 200].map((h, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl" style={{ height: h }} />
            ))}
          </div>
          <div className="w-72 space-y-4 shrink-0">
            {[200, 140, 120, 100].map((h, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl" style={{ height: h }} />
            ))}
          </div>
        </div>
      ) : data && (
        <div className="flex gap-5 items-start">

          {/* ── Columna principal ─────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* KPIs */}
            <div className="grid grid-cols-6 gap-3">
              <KpiCard icon={BarChart3}     label="Total operaciones"  value={data.stats.total}            sub="Activas"                               iconBg="bg-gray-100"   iconCl="text-gray-600" />
              <KpiCard icon={Package}       label="Valor total"        value={formatCurrency(data.stats.valor_total)} sub="En operaciones"              iconBg="bg-emerald-100" iconCl="text-emerald-600" />
              <KpiCard icon={Hammer}        label="En producción"      value={data.stats.en_produccion}    sub={formatCurrency(data.stats.valor_produccion)} iconBg="bg-amber-100"  iconCl="text-amber-600" subCl="text-amber-600 font-semibold" />
              <KpiCard icon={Truck}         label="Listos para entregar" value={data.stats.listos}         sub={formatCurrency(data.stats.valor_listos)} iconBg="bg-teal-100"   iconCl="text-teal-600" />
              <KpiCard icon={AlertTriangle} label="Atrasadas"          value={data.stats.atrasadas}        sub={formatCurrency(data.stats.valor_atrasadas)} iconBg="bg-red-100"    iconCl="text-red-500"  subCl="text-red-500 font-semibold" />
              <KpiCard icon={CheckCircle2}  label="Entregadas (semana)" value={data.stats.entregadas_semana} sub={formatCurrency(data.stats.valor_entregadas_semana)} iconBg="bg-blue-100"  iconCl="text-blue-600" />
            </div>

            {/* Alertas + filtros */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Operaciones que requieren tu atención</p>
              <div className="flex items-start gap-3 mb-4">
                <AlertChip icon={AlertTriangle} count={cntAtrasadas}    label="atrasadas"         sub="Requieren acción inmediata"       color="red" />
                <AlertChip icon={Clock}         count={cntPorVencerHoy} label="por vencer hoy"    sub="Entregas programadas para hoy"   color="amber" />
                <AlertChip icon={Package}       count={cntListasNoEnt}  label="lista sin entregar" sub="Pendiente de coordinación"      color="orange" />
              </div>
              <div className="flex items-center gap-2">
                {([
                  { key: 'todas',      label: `Todas ${data.detalle.length}` },
                  { key: 'atrasadas',  label: `Atrasadas ${cntAtrasadas}` },
                  { key: 'por_vencer', label: `Por vencer ${cntPorVencer}` },
                  { key: 'hoy',        label: `Hoy ${cntHoy}` },
                ] as { key: Filtro; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFiltro(key)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      filtro === key
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kanban */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} className="text-amber-500" />
                <h2 className="text-sm font-bold text-gray-800">Tablero de producción</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                <KCol title="Confirmado"        color="green" ops={data.kanban.confirmado}    onEstado={handleEstado} />
                <KCol title="En producción"     color="amber" ops={data.kanban.en_produccion} onEstado={handleEstado} />
                <KCol title="Listo p/ entregar" color="teal"  ops={data.kanban.listo}         onEstado={handleEstado} />
                <KCol title="Entregado"         color="blue"  ops={data.kanban.entregado}     onEstado={handleEstado} />
                <KCol title="Cancelado"         color="red"   ops={data.kanban.cancelado}     onEstado={handleEstado} />
              </div>
            </div>

            {/* Listado detallado */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-800">Listado detallado</h2>
                <span className="text-xs text-gray-400">{detalleFiltrado.length} operaciones</span>
              </div>

              {detalleFiltrado.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm text-gray-400">Sin operaciones en esta vista</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        {['Operación', 'Cliente', 'Medidas / Producto', 'Estado', 'Inicio', 'Vence / Entrega', 'Días en estado', 'Importe', 'Acciones'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detalleFiltrado.map(op => {
                        const dias = diasHasta(op.fecha_entrega_estimada);
                        const atrasado = dias !== null && dias < 0 && !['entregado', 'cancelado'].includes(op.estado);
                        const waLink = op.cliente.telefono
                          ? `https://wa.me/${op.cliente.telefono.replace(/\D/g, '')}`
                          : null;
                        return (
                          <tr key={op.id} className={cn('hover:bg-gray-50 transition-colors', atrasado && 'bg-red-50/30')}>
                            <td className="px-4 py-3">
                              <p className="font-mono text-[12px] font-bold text-blue-600">{op.numero}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                                {TIPO_LABEL[op.tipo] ?? op.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-[12px] font-semibold text-gray-800 whitespace-nowrap">{ncl(op.cliente)}</p>
                              {op.cliente.telefono && (
                                <p className="text-[10px] text-gray-400">{op.cliente.telefono}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              {op.medidas && <p className="text-[11px] font-mono text-gray-600">{op.medidas}</p>}
                              {op.primer_item && (
                                <p className="text-[11px] text-gray-500 truncate">{op.primer_item}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                                {
                                  aprobado: 'bg-emerald-100 text-emerald-700',
                                  en_produccion: 'bg-amber-100 text-amber-700',
                                  listo: 'bg-teal-100 text-teal-700',
                                  entregado: 'bg-blue-100 text-blue-700',
                                  cancelado: 'bg-red-100 text-red-600',
                                }[op.estado] ?? 'bg-gray-100 text-gray-600'
                              )}>
                                {{ aprobado: 'Confirmado', en_produccion: 'En producción', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' }[op.estado] ?? op.estado}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-[12px] text-gray-600">{fmtFecha(op.created_at)}</p>
                            </td>
                            <td className="px-4 py-3">
                              {op.fecha_entrega_estimada && (
                                <p className="text-[11px] text-gray-500 mb-0.5">{fmtFecha(op.fecha_entrega_estimada)}</p>
                              )}
                              <VenceBadge iso={op.fecha_entrega_estimada} />
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                                op.dias_en_estado > 14 ? 'bg-red-100 text-red-700' :
                                op.dias_en_estado > 7 ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              )}>
                                {op.dias_en_estado} día{op.dias_en_estado !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-[13px] font-extrabold text-gray-900 tabular-nums">{formatCurrency(Number(op.precio_total))}</p>
                              {op.margen > 0 && (
                                <p className="text-[10px] text-gray-400">{op.margen}% margen</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {waLink && (
                                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                                    className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 flex items-center justify-center transition-colors"
                                    onClick={e => e.stopPropagation()}>
                                    <MessageCircle size={13} className="text-green-600" />
                                  </a>
                                )}
                                {op.cliente.telefono && (
                                  <a href={`tel:${op.cliente.telefono}`}
                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center justify-center transition-colors"
                                    onClick={e => e.stopPropagation()}>
                                    <Phone size={13} className="text-blue-600" />
                                  </a>
                                )}
                                <Link to={`/operaciones/${op.id}`}
                                  className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center transition-colors">
                                  <Eye size={13} className="text-gray-600" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400">
                    Mostrando {detalleFiltrado.length} de {data.detalle.length} operaciones
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <div className="w-[280px] shrink-0 space-y-4">

            {/* Entregas programadas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock size={14} className="text-blue-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Entregas programadas</h2>
              </div>

              {[
                { label: `Hoy - ${now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`, ops: proximasHoy, color: 'text-emerald-700 bg-emerald-100' },
                { label: `Mañana - ${new Date(now.getTime() + 86_400_000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`, ops: proximasMañana, color: 'text-amber-700 bg-amber-100' },
                { label: 'Esta semana', ops: proximasSemana, color: 'text-gray-600 bg-gray-100' },
              ].map(({ label, ops: grp, color }) => grp.length > 0 && (
                <div key={label} className="mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[11px] font-bold text-gray-700 flex-1">{label}</p>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${color}`}>{grp.length}</span>
                  </div>
                  {grp.map(p => (
                    <Link key={p.id} to={`/operaciones/${p.id}`}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-[11px] font-mono font-bold text-blue-600">{p.numero}</p>
                        <p className="text-[11px] text-gray-600 truncate max-w-[130px]">{nclProxima(p.cliente)}</p>
                      </div>
                      <p className="text-[11px] font-bold text-gray-800 tabular-nums">{formatCurrency(Number(p.precio_total))}</p>
                    </Link>
                  ))}
                </div>
              ))}

              {data.proximas.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Sin entregas programadas esta semana</p>
              )}

              <Link to="/remitos" className="flex items-center justify-center gap-1 mt-1 py-2 text-[12px] font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors">
                <CalendarClock size={13} /> Ver calendario completo
              </Link>
            </div>

            {/* Carga de trabajo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-amber-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Carga de trabajo</h2>
              </div>
              <div className="flex items-center gap-3">
                <DonutChart
                  a={data.stats.en_produccion}
                  b={data.stats.listos}
                  c={data.stats.atrasadas}
                />
                <div className="space-y-1.5">
                  {[
                    { color: 'bg-amber-400', label: 'En producción', count: data.stats.en_produccion },
                    { color: 'bg-emerald-400', label: 'Listo', count: data.stats.listos },
                    { color: 'bg-orange-400', label: 'Pendientes', count: data.stats.atrasadas },
                  ].map(({ color, label, count }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-[11px] text-gray-600">{label}</span>
                      <span className="text-[11px] font-bold text-gray-800 ml-auto">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-gray-600">Capacidad de producción</p>
                  <span className="text-[11px] font-bold text-gray-800">{capacidadPct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${capacidadPct > 90 ? 'bg-red-500' : capacidadPct > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${capacidadPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{cuposUsados} de {maxCupos} cupos ocupados</p>
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-violet-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones rápidas</h2>
              </div>
              <div className="space-y-2">
                {[
                  { icon: CheckCircle2, label: 'Marcar como listo',      href: '/operaciones?estado=en_produccion', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                  { icon: Truck,        label: 'Marcar como entregado',  href: '/operaciones?estado=listo',         color: 'text-blue-600 bg-blue-50 border-blue-200' },
                  { icon: PrinterIcon,  label: 'Imprimir orden de trabajo', href: '/operaciones',                  color: 'text-orange-600 bg-orange-50 border-orange-200' },
                  { icon: BarChart3,    label: 'Ver reportes de producción', href: '/reportes',                    color: 'text-violet-600 bg-violet-50 border-violet-200' },
                ].map(({ icon: Icon, label, href, color }) => (
                  <Link key={label} to={href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[12px] font-semibold transition-all hover:opacity-80 ${color}`}>
                    <Icon size={14} />
                    {label}
                    <ChevronRight size={12} className="ml-auto" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
