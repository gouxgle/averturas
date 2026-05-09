import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, Package, Truck,
  DollarSign, Users, BarChart3, ShoppingCart, Target,
  Calendar, FileText, Download, Edit2, Check, X,
  ArrowRight, ChevronRight, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Alerta {
  tipo: string;
  mensaje: string;
  accion: string;
  ruta: string;
}

interface ResumenData {
  periodo: { desde: string; hasta: string };
  kpis: {
    ventas_periodo: number;
    ventas_vs_anterior: number;
    cobrado_periodo: number;
    cobrado_vs_anterior: number;
    pendiente_cobro: number;
    stock_critico: number;
    entregas_atrasadas: number;
    tasa_cierre: number;
  };
  evolucion: Array<{ fecha: string; actual: number; anterior: number }>;
  comercial: {
    total_generados: number;
    aprobados: number;
    cancelados: number;
    en_proceso: number;
    tasa_cierre: number;
  };
  finanzas: {
    cobrado: number;
    pendiente: number;
    vencido: number;
    dias_promedio_cobro: number;
  };
  top_tipos: Array<{ tipo: string; monto_total: number; cant_total: number }>;
  stock_counts: { critico: number; sin_movimiento_30d: number; sin_stock: number };
  operaciones: {
    en_produccion: number;
    listo: number;
    atrasadas: number;
    remitos_total: number;
    remitos_entregados: number;
    cumplimiento_pct: number;
    dias_promedio_entrega: number;
  };
  compras: { compras_periodo: number; deuda_proveedores: number };
  top_clientes: Array<{
    id: string;
    nombre: string;
    apellido: string;
    razon_social: string;
    total_ventas: number;
    cant_ops: number;
  }>;
  metodos_pago: Array<{ forma_pago: string; cant: number; monto_total: number }>;
  objetivo: { objetivo_ventas: number; ventas_actuales: number; cumplimiento_pct: number };
  alertas: Alerta[];
}

type FiltroTiempo = 'hoy' | 'semana' | 'mes' | 'personalizado';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtM = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-AR')}`;
};

const fmtP = (n: number): string => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string): string => {
  const d = new Date(iso + 'T12:00:00');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
};

const hoy = (): string => new Date().toISOString().slice(0, 10);

const primerDiaMes = (): string => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const lunes = (): string => {
  const d = new Date();
  const dia = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
};

const COLORES_PIE = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4'];

// ── Sub-componentes ───────────────────────────────────────────────────────────

function VsAnterior({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const sube = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${sube ? 'text-green-600' : 'text-red-500'}`}>
      {sube ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {sube ? '+' : ''}{pct}% vs mes ant.
    </span>
  );
}

function KpiCard({
  icon, color, label, value, sub, badge,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  sub?: React.ReactNode;
  badge?: { text: string; danger?: boolean };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1.5">
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
        {icon}
      </div>
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900 leading-none">{value}</span>
        {badge && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge.danger ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
            {badge.text}
          </span>
        )}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DonutChart({ segments, size = 80 }: {
  segments: Array<{ valor: number; color: string }>;
  size?: number;
}) {
  const total = segments.reduce((s, g) => s + g.valor, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={size/2 - 6} fill="none" stroke="#F3F4F6" strokeWidth={10} />
      </svg>
    );
  }
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  let acum = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const dash = (seg.valor / total) * circ;
        const offset = circ - acum;
        acum += dash;
        return (
          <circle
            key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={10}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offset}
          />
        );
      })}
    </svg>
  );
}

function GaugePct({ pct, color = '#10B981' }: { pct: number; color?: string }) {
  const size = 80;
  const r = 32;
  const circ = Math.PI * r; // semicircle
  const filled = Math.min(pct, 100) / 100 * circ;
  return (
    <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
      <path
        d={`M 8 ${size/2} A ${r} ${r} 0 0 1 ${size - 8} ${size/2}`}
        fill="none" stroke="#F3F4F6" strokeWidth={10} strokeLinecap="round"
      />
      <path
        d={`M 8 ${size/2} A ${r} ${r} 0 0 1 ${size - 8} ${size/2}`}
        fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
      />
      <text x={size/2} y={size/2 + 2} textAnchor="middle" fontSize="13" fontWeight="700" fill="#111827">
        {pct}%
      </text>
    </svg>
  );
}

function AlertaCard({ alerta }: { alerta: Alerta }) {
  const cfg: Record<string, { bg: string; border: string; icon: React.ReactNode; txt: string }> = {
    entregas: { bg: 'bg-orange-50', border: 'border-orange-200', icon: <Truck size={16} className="text-orange-500" />, txt: 'text-orange-700' },
    deuda:    { bg: 'bg-red-50',    border: 'border-red-200',    icon: <DollarSign size={16} className="text-red-500" />,  txt: 'text-red-700'    },
    stock:    { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <Package size={16} className="text-amber-600" />,   txt: 'text-amber-700'  },
    cobro:    { bg: 'bg-red-50',    border: 'border-red-200',    icon: <TrendingDown size={16} className="text-red-500" />,txt: 'text-red-700'    },
  };
  const c = cfg[alerta.tipo] ?? cfg['stock'];
  return (
    <div className={`rounded-xl border ${c.bg} ${c.border} p-3`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{c.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${c.txt} leading-tight`}>{alerta.mensaje}</p>
          <Link to={alerta.ruta} className={`text-xs font-semibold ${c.txt} hover:underline mt-1 inline-flex items-center gap-0.5`}>
            {alerta.accion} <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function Reportes() {
  const navigate = useNavigate();

  const [filtro, setFiltro] = useState<FiltroTiempo>('mes');
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);
  const [data, setData] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editandoObjetivo, setEditandoObjetivo] = useState(false);
  const [nuevoObjetivo, setNuevoObjetivo] = useState('');
  const [guardandoObj, setGuardandoObj] = useState(false);

  const aplicarFiltro = useCallback((f: FiltroTiempo) => {
    setFiltro(f);
    const h = hoy();
    if (f === 'hoy')   { setDesde(h); setHasta(h); }
    if (f === 'semana') { setDesde(lunes()); setHasta(h); }
    if (f === 'mes')    { setDesde(primerDiaMes()); setHasta(h); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get<ResumenData>(`/informes/resumen?desde=${desde}&hasta=${hasta}`);
      setData(result);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const guardarObjetivo = async () => {
    if (!data) return;
    const valor = parseFloat(nuevoObjetivo.replace(/[^0-9.]/g, ''));
    if (isNaN(valor)) return;
    setGuardandoObj(true);
    try {
      await api.put('/empresa', {
        nombre: 'Mi Empresa',
        objetivo_ventas_mensual: valor,
      });
      setData(prev => prev ? {
        ...prev,
        objetivo: {
          ...prev.objetivo,
          objetivo_ventas: valor,
          cumplimiento_pct: valor > 0 ? Math.round(prev.objetivo.ventas_actuales / valor * 100) : 0,
        },
      } : prev);
      setEditandoObjetivo(false);
    } finally {
      setGuardandoObj(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Período', data.periodo.desde, data.periodo.hasta],
      [],
      ['VENTAS DEL PERÍODO', data.kpis.ventas_periodo],
      ['COBRADO', data.kpis.cobrado_periodo],
      ['PENDIENTE', data.kpis.pendiente_cobro],
      ['TASA DE CIERRE', `${data.kpis.tasa_cierre}%`],
      [],
      ['TOP CLIENTES', '', ''],
      ['Cliente', 'Ventas', 'Ops'],
      ...data.top_clientes.map(c => [
        c.razon_social || `${c.nombre} ${c.apellido}`,
        c.total_ventas,
        c.cant_ops,
      ]),
      [],
      ['TOP PRODUCTOS', '', ''],
      ['Tipo', 'Monto', 'Cant'],
      ...data.top_tipos.map(t => [t.tipo, t.monto_total, t.cant_total]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `informe_${desde}_${hasta}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalMetodos = useMemo(() =>
    data?.metodos_pago.reduce((s, m) => s + m.monto_total, 0) ?? 0,
  [data]);

  const pieMetodos = useMemo(() =>
    data?.metodos_pago.map((m, i) => ({
      name:  m.forma_pago,
      value: m.monto_total,
      color: COLORES_PIE[i % COLORES_PIE.length],
    })) ?? [],
  [data]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
        <p className="text-gray-600 text-sm">{error}</p>
        <button onClick={fetchData} className="mt-3 text-sm text-blue-600 hover:underline">Reintentar</button>
      </div>
    );
  }

  const kpis = data?.kpis;
  const com  = data?.comercial;
  const fin  = data?.finanzas;
  const ops  = data?.operaciones;

  return (
    <div className="p-5 space-y-5 max-w-[1600px]">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Informes del negocio</h1>
            <p className="text-xs text-gray-500">Entendé qué está pasando y tomá mejores decisiones</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro período */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {(['hoy','semana','mes'] as FiltroTiempo[]).map(f => (
              <button
                key={f}
                onClick={() => aplicarFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  filtro === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
            <button
              onClick={() => setFiltro('personalizado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                filtro === 'personalizado' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar size={12} />
              Personalizado
            </button>
          </div>

          {filtro === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
              <span className="text-gray-400 text-xs">—</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
              <button onClick={fetchData}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                Aplicar
              </button>
            </div>
          )}

          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium">
            <FileText size={13} />
            Exportar PDF
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg text-xs font-medium">
            <Download size={13} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── KPIs row ── */}
      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard
            icon={<DollarSign size={16} className="text-green-600" />}
            color="bg-green-100"
            label="Ventas del mes"
            value={fmtM(kpis?.ventas_periodo ?? 0)}
            sub={<VsAnterior pct={kpis?.ventas_vs_anterior ?? 0} />}
          />
          <KpiCard
            icon={<Target size={16} className="text-violet-600" />}
            color="bg-violet-100"
            label="Tasa de cierre"
            value={`${kpis?.tasa_cierre ?? 0}%`}
            sub={<span className="text-gray-400">de ops generadas</span>}
          />
          <KpiCard
            icon={<CheckCircle2 size={16} className="text-blue-600" />}
            color="bg-blue-100"
            label="Cobrado"
            value={fmtM(kpis?.cobrado_periodo ?? 0)}
            sub={<VsAnterior pct={kpis?.cobrado_vs_anterior ?? 0} />}
          />
          <KpiCard
            icon={<Clock size={16} className="text-orange-500" />}
            color="bg-orange-100"
            label="Pendiente de cobro"
            value={fmtM(kpis?.pendiente_cobro ?? 0)}
            sub={<span className="text-gray-400">compromisos activos</span>}
          />
          <KpiCard
            icon={<Package size={16} className="text-red-500" />}
            color="bg-red-100"
            label="Stock crítico"
            value={String(kpis?.stock_critico ?? 0)}
            badge={kpis && kpis.stock_critico > 0 ? { text: 'Alerta', danger: true } : undefined}
            sub={<Link to="/stock" className="text-red-500 hover:underline">Ver stock</Link>}
          />
          <KpiCard
            icon={<Truck size={16} className="text-amber-600" />}
            color="bg-amber-100"
            label="Entregas atrasadas"
            value={String(kpis?.entregas_atrasadas ?? 0)}
            badge={kpis && kpis.entregas_atrasadas > 0 ? { text: 'Revisar' } : undefined}
            sub={<Link to="/remitos" className="text-amber-600 hover:underline">Ver remitos</Link>}
          />
        </div>
      )}

      {/* ── Chart + Alertas ── */}
      <div className="flex gap-4">
        {/* Chart */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Evolución de ventas</h2>
          <p className="text-xs text-gray-400 mb-4">
            {data?.evolucion.some(e => e.actual > 0) ? 'Ventas aprobadas por día' : 'Sin datos en el período'}
          </p>
          {loading ? (
            <div className="h-52 bg-gray-50 animate-pulse rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={data?.evolucion ?? []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAnterior" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#9CA3AF" stopOpacity={0.10} />
                    <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis
                  dataKey="fecha"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  interval={Math.ceil((data?.evolucion.length ?? 7) / 7) - 1}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => fmtM(v)}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(val: unknown, name: unknown) => [fmtP(Number(val)), name === 'actual' ? 'Ventas actuales' : 'Mes anterior']}
                  labelFormatter={(label: unknown) => fmtDate(String(label))}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                />
                <Legend
                  formatter={v => v === 'actual' ? 'Ventas actuales' : 'Período anterior'}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Area type="monotone" dataKey="anterior" stroke="#D1D5DB" fill="url(#gradAnterior)"
                  strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                <Area type="monotone" dataKey="actual"   stroke="#3B82F6" fill="url(#gradActual)"
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alertas + Acciones */}
        <div className="w-64 shrink-0 space-y-3">
          {/* Alertas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <AlertCircle size={13} className="text-red-500" />
              Alertas importantes
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />)}
              </div>
            ) : data?.alertas.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 size={24} className="text-green-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Todo en orden</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.alertas.map((a, i) => <AlertaCard key={i} alerta={a} />)}
              </div>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Acciones rápidas</h3>
            <div className="space-y-0.5">
              {[
                { label: 'Ver detalle de ventas', ruta: '/operaciones' },
                { label: 'Ver cobranzas',         ruta: '/recibos' },
                { label: 'Ver stock',             ruta: '/stock' },
                { label: 'Ver proveedores',       ruta: '/proveedores' },
                { label: 'Ver clientes',          ruta: '/clientes' },
              ].map(a => (
                <button key={a.ruta} onClick={() => navigate(a.ruta)}
                  className="w-full flex items-center justify-between px-2 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group">
                  <span>{a.label}</span>
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500" />
                </button>
              ))}
              <button onClick={() => window.print()}
                className="w-full flex items-center justify-between px-2 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group">
                <span>Generar reporte completo</span>
                <ChevronRight size={12} className="text-blue-300 group-hover:text-blue-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5 bloques sectoriales ── */}
      {loading ? (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-52 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">

          {/* Comercial */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp size={13} className="text-green-600" />
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Comercial</span>
            </div>
            <div className="space-y-2.5">
              <MiniBar label="Generados" value={com?.total_generados ?? 0} max={com?.total_generados ?? 1} color="bg-gray-400" />
              <MiniBar label="Aprobados" value={com?.aprobados ?? 0} max={com?.total_generados ?? 1} color="bg-green-500" />
              <MiniBar label="Perdidos"  value={com?.cancelados ?? 0} max={com?.total_generados ?? 1} color="bg-red-400" />
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">Tasa de cierre</div>
              <div className="text-2xl font-bold text-gray-900">{com?.tasa_cierre ?? 0}%</div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${com?.tasa_cierre ?? 0}%` }} />
              </div>
            </div>
          </div>

          {/* Finanzas */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <DollarSign size={13} className="text-blue-600" />
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Finanzas</span>
            </div>
            <div className="flex items-center justify-between">
              <DonutChart
                size={76}
                segments={[
                  { valor: fin?.cobrado ?? 0,  color: '#3B82F6' },
                  { valor: fin?.pendiente ?? 0, color: '#F59E0B' },
                  { valor: fin?.vencido ?? 0,   color: '#EF4444' },
                ]}
              />
              <div className="space-y-1.5 text-right text-xs">
                <div><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Cobrado<br />
                  <span className="font-semibold text-gray-800">{fmtM(fin?.cobrado ?? 0)}</span>
                </div>
                <div><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Pendiente<br />
                  <span className="font-semibold text-gray-800">{fmtM(fin?.pendiente ?? 0)}</span>
                </div>
                {(fin?.vencido ?? 0) > 0 && (
                  <div><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Vencido<br />
                    <span className="font-semibold text-red-600">{fmtM(fin?.vencido ?? 0)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              Días prom. cobro:
              <span className="font-bold text-gray-800 ml-1">{fin?.dias_promedio_cobro ?? 0} días</span>
            </div>
          </div>

          {/* Productos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Package size={13} className="text-amber-600" />
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Productos</span>
            </div>
            <div className="space-y-1.5">
              {(data?.top_tipos ?? []).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin ventas en el período</p>
              ) : (
                (data?.top_tipos ?? []).slice(0, 4).map((t, i) => {
                  const max = data!.top_tipos[0].monto_total;
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span className="truncate max-w-[120px]">{t.tipo}</span>
                        <span className="font-semibold">{fmtM(t.monto_total)}</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${max > 0 ? t.monto_total / max * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 text-xs text-gray-500">
              <span>Sin stock: <strong className="text-red-600">{data?.stock_counts.sin_stock ?? 0}</strong></span>
              <span>Sin mvto: <strong>{data?.stock_counts.sin_movimiento_30d ?? 0}</strong></span>
            </div>
          </div>

          {/* Operaciones */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <BarChart3 size={13} className="text-violet-600" />
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Operaciones</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  <span className="text-gray-500">En producción</span>
                  <span className="font-bold ml-auto">{ops?.en_produccion ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  <span className="text-gray-500">Listos</span>
                  <span className="font-bold ml-auto">{ops?.listo ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <span className="text-gray-500">Atrasados</span>
                  <span className="font-bold text-red-600 ml-auto">{ops?.atrasadas ?? 0}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 mb-1">Cumplimiento entregas</div>
              <div className="flex items-center gap-2">
                <GaugePct
                  pct={ops?.cumplimiento_pct ?? 100}
                  color={ops && ops.cumplimiento_pct >= 80 ? '#10B981' : ops && ops.cumplimiento_pct >= 60 ? '#F59E0B' : '#EF4444'}
                />
                <div className="text-xs text-gray-500">
                  {ops?.remitos_entregados ?? 0}/{ops?.remitos_total ?? 0} remitos
                  {(ops?.dias_promedio_entrega ?? 0) > 0 && (
                    <div>Prom: {ops?.dias_promedio_entrega} días</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Proveedores */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <ShoppingCart size={13} className="text-orange-600" />
              </div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Proveedores</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Compras del período</div>
                <div className="text-xl font-bold text-gray-900">{fmtM(data?.compras.compras_periodo ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Deuda con proveedores</div>
                <div className={`text-xl font-bold ${(data?.compras.deuda_proveedores ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {fmtM(data?.compras.deuda_proveedores ?? 0)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Link to="/proveedores" className="text-xs text-orange-600 hover:underline font-medium flex items-center gap-1">
                Ver proveedores <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom: Rankings + Métodos pago + Objetivos ── */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-56 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

          {/* Mejores clientes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Users size={12} className="text-blue-500" />
                Mejores clientes
              </h3>
              <Link to="/clientes" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
            </div>
            {(data?.top_clientes ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos en el período</p>
            ) : (
              <div className="space-y-2">
                {(data?.top_clientes ?? []).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">
                        {c.razon_social || `${c.nombre} ${c.apellido ?? ''}`.trim()}
                      </div>
                      <div className="text-xs text-gray-400">{c.cant_ops} op{c.cant_ops !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-800">{fmtM(c.total_ventas)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Productos más vendidos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Package size={12} className="text-amber-500" />
                Productos más vendidos
              </h3>
              <Link to="/productos" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
            </div>
            {(data?.top_tipos ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos en el período</p>
            ) : (
              <div className="space-y-2">
                {(data?.top_tipos ?? []).map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-4 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{t.tipo}</div>
                      <div className="text-xs text-gray-400">{t.cant_total} unid.</div>
                    </div>
                    <div className="text-xs font-bold text-gray-800">{fmtM(t.monto_total)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Métodos de pago */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign size={12} className="text-green-500" />
                Métodos de pago
              </h3>
              <Link to="/recibos" className="text-xs text-blue-600 hover:underline">Ver cobros →</Link>
            </div>
            {(data?.metodos_pago ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin cobros en el período</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <ResponsiveContainer width={80} height={80}>
                    <PieChart>
                      <Pie data={pieMetodos} cx={35} cy={35} innerRadius={22} outerRadius={36}
                        dataKey="value" paddingAngle={2}>
                        {pieMetodos.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {(data?.metodos_pago ?? []).map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-gray-600 truncate max-w-[80px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORES_PIE[i % COLORES_PIE.length] }} />
                        {m.forma_pago}
                      </span>
                      <span className="font-semibold text-gray-700">
                        {totalMetodos > 0 ? Math.round(m.monto_total / totalMetodos * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Objetivos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Target size={12} className="text-violet-500" />
                Objetivos del mes
              </h3>
              {!editandoObjetivo && (
                <button onClick={() => { setNuevoObjetivo(String(data?.objetivo.objetivo_ventas ?? 0)); setEditandoObjetivo(true); }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <Edit2 size={11} />
                </button>
              )}
            </div>

            {editandoObjetivo ? (
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Objetivo de ventas</label>
                <input
                  type="number"
                  value={nuevoObjetivo}
                  onChange={e => setNuevoObjetivo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  placeholder="0"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button onClick={guardarObjetivo} disabled={guardandoObj}
                    className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white text-xs py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    <Check size={11} /> Guardar
                  </button>
                  <button onClick={() => setEditandoObjetivo(false)}
                    className="flex-1 flex items-center justify-center gap-1 border border-gray-200 text-gray-600 text-xs py-1.5 rounded-lg hover:bg-gray-50">
                    <X size={11} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.objetivo.objetivo_ventas ?? 0) === 0 ? (
                  <div className="text-center py-4">
                    <Target size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Sin objetivo configurado</p>
                    <button onClick={() => { setNuevoObjetivo(''); setEditandoObjetivo(true); }}
                      className="mt-2 text-xs text-blue-600 hover:underline">
                      Configurar objetivo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Ventas objetivo</span>
                      <span className="font-bold text-gray-700">{fmtP(data?.objetivo.objetivo_ventas ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Ventas actuales</span>
                      <span className="font-bold text-gray-900">{fmtP(data?.objetivo.ventas_actuales ?? 0)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Cumplimiento</span>
                        <span className={`font-bold ${(data?.objetivo.cumplimiento_pct ?? 0) >= 100 ? 'text-green-600' : (data?.objetivo.cumplimiento_pct ?? 0) >= 75 ? 'text-blue-600' : 'text-orange-500'}`}>
                          {data?.objetivo.cumplimiento_pct ?? 0}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (data?.objetivo.cumplimiento_pct ?? 0) >= 100 ? 'bg-green-500' :
                            (data?.objetivo.cumplimiento_pct ?? 0) >= 75 ? 'bg-blue-500' : 'bg-orange-400'
                          }`}
                          style={{ width: `${Math.min(data?.objetivo.cumplimiento_pct ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
