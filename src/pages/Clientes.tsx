import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Upload, Search, Users, Phone, MessageCircle,
  History, TrendingUp, TrendingDown, Clock, Star,
  AlertCircle, UserPlus, RefreshCw, ChevronLeft, ChevronRight,
  Receipt, FileText, X, Download, Filter,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ── Tipos ────────────────────────────────────────────────────────

type Segmento = 'nuevo' | 'inactivo' | 'seguimiento' | 'frecuente' | 'activo';

interface ClientePanel {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  email: string | null;
  documento_nro: string | null;
  localidad: string | null;
  estado: string;
  created_at: string;
  ultima_interaccion: string | null;
  dias_sin_contacto: number;
  categoria_nombre: string | null;
  categoria_color: string | null;
  operaciones_count: number;
  valor_total_historico: number;
  ticket_promedio: number;
  total_deuda: number;
  count_deuda: number;
  segmento: Segmento;
}

interface PanelData {
  stats: {
    total: number; activos: number; sin_actividad: number;
    nuevos_mes: number; total_facturado_mes: number; clientes_top: number;
  };
  clientes: ClientePanel[];
  oportunidades: {
    sin_contacto_30d: number;
    presupuestos_sin_respuesta: number;
    pagos_vencidos: number;
    para_seguimiento: number;
  };
  por_localidad: { localidad: string; count: number; pct: number }[];
  actividad_reciente: { tipo: string; descripcion: string; cliente_nombre: string; fecha: string }[];
  resumen: {
    sin_actividad_60d: number;
    mayor_compra: { cliente_nombre: string; monto: number; operaciones: number } | null;
    mejor_cliente_mes: { cliente_nombre: string; monto: number; compras: number } | null;
    ticket_promedio_mes: number;
    ticket_trend: number;
  };
}

type TabFilter = 'todos' | 'activos' | 'seguimiento' | 'nuevos' | 'inactivos' | 'top';
type Orden = 'ultima_actividad' | 'mayor_compra' | 'mas_reciente' | 'nombre';

// ── Helpers ──────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-sky-100',     text: 'text-sky-700' },
  { bg: 'bg-violet-100',  text: 'text-violet-700' },
  { bg: 'bg-amber-100',   text: 'text-amber-700' },
  { bg: 'bg-rose-100',    text: 'text-rose-700' },
  { bg: 'bg-teal-100',    text: 'text-teal-700' },
  { bg: 'bg-orange-100',  text: 'text-orange-700' },
  { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function getInitials(c: ClientePanel) {
  if (c.tipo_persona === 'juridica') {
    const words = (c.razon_social ?? '').trim().split(/\s+/).filter(Boolean);
    return words.map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  }
  const a = (c.apellido ?? '').charAt(0).toUpperCase();
  const n = (c.nombre ?? '').charAt(0).toUpperCase();
  if (a && n) return a + n;
  return a || n || '?';
}

function nombreDisplay(c: ClientePanel) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function actividadInfo(dias: number): { label: string; dotColor: string } {
  if (dias >= 999) return { label: 'Sin registro',    dotColor: 'bg-gray-300' };
  if (dias === 0)  return { label: 'Hoy',             dotColor: 'bg-emerald-500' };
  if (dias === 1)  return { label: 'Ayer',            dotColor: 'bg-emerald-500' };
  if (dias <= 7)   return { label: `Hace ${dias} días`, dotColor: 'bg-emerald-500' };
  if (dias <= 30)  return { label: `Hace ${dias} días`, dotColor: 'bg-amber-500' };
  return             { label: `Hace ${dias} días`,    dotColor: 'bg-red-500' };
}

function fmtFechaCorta(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtRelativa(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);
  if (diffMin < 60)  return `Hace ${diffMin} min`;
  if (diffH < 24)    return `Hoy, ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  if (diffD === 1)   return `Ayer, ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  return `Hace ${diffD} días`;
}

const SEG_CFG: Record<Segmento | 'top', { label: string; bg: string; text: string }> = {
  nuevo:      { label: 'Nuevo',             bg: 'bg-violet-100',  text: 'text-violet-700' },
  top:        { label: '⭐ Top cliente',    bg: 'bg-amber-100',   text: 'text-amber-700' },
  inactivo:   { label: 'Inactivo',          bg: 'bg-gray-100',    text: 'text-gray-500' },
  seguimiento:{ label: 'En seguimiento',    bg: 'bg-sky-100',     text: 'text-sky-700' },
  frecuente:  { label: 'Cliente frecuente', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  activo:     { label: 'Activo',            bg: 'bg-emerald-50',  text: 'text-emerald-600' },
};

const DONUT_COLORS = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b', '#f43f5e', '#14b8a6'];

function DonutChart({ data }: { data: { label: string; pct: number; count: number }[] }) {
  const r = 28, cx = 36, cy = 36, circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.map((d, i) => {
    const dash = (d.pct / 100) * circ;
    const seg = { ...d, dash, offset, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    offset += dash;
    return seg;
  });
  return (
    <div className="flex items-center gap-3">
      <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10} />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={10}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)} />
        ))}
      </svg>
      <div className="space-y-1 flex-1 min-w-0">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[11px] text-gray-600 truncate">{s.label}</span>
            </div>
            <span className="text-[11px] font-semibold text-gray-700 shrink-0">{s.count} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────

const PER_PAGE = 10;

export function Clientes() {
  const navigate    = useNavigate();
  const [data, setData]       = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [tab, setTab]         = useState<TabFilter>('todos');
  const [orden, setOrden]     = useState<Orden>('ultima_actividad');
  const [page, setPage]       = useState(1);
  const [ordenOpen, setOrdenOpen] = useState(false);
  const ordenRef = useRef<HTMLDivElement>(null);
  const [filtroEstado, setFiltroEstado] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<PanelData>('/clientes/panel'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ordenRef.current && !ordenRef.current.contains(e.target as Node)) setOrdenOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clientes = data?.clientes ?? [];

  // Top 10 por valor histórico (con al menos 1 operación)
  const topIds = useMemo(() => {
    const conVal = [...clientes].filter(c => c.valor_total_historico > 0)
      .sort((a, b) => b.valor_total_historico - a.valor_total_historico)
      .slice(0, 10);
    return new Set(conVal.map(c => c.id));
  }, [clientes]);

  function efectivoSegmento(c: ClientePanel): Segmento | 'top' {
    if (c.segmento === 'nuevo') return 'nuevo';
    if (topIds.has(c.id)) return 'top';
    return c.segmento;
  }

  const conteos = useMemo(() => {
    const c = { todos: clientes.length, activos: 0, seguimiento: 0, nuevos: 0, inactivos: 0, top: topIds.size };
    clientes.forEach(cl => {
      const seg = efectivoSegmento(cl);
      if (seg === 'activo' || seg === 'frecuente' || seg === 'top') c.activos++;
      if (seg === 'seguimiento') c.seguimiento++;
      if (seg === 'nuevo') c.nuevos++;
      if (seg === 'inactivo') c.inactivos++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, topIds]);

  const filtrado = useMemo(() => {
    let list = [...clientes];

    // Tab filter
    if (tab !== 'todos') {
      list = list.filter(c => {
        const seg = efectivoSegmento(c);
        if (tab === 'activos')    return seg === 'activo' || seg === 'frecuente' || seg === 'top';
        if (tab === 'seguimiento') return seg === 'seguimiento';
        if (tab === 'nuevos')      return seg === 'nuevo';
        if (tab === 'inactivos')   return seg === 'inactivo';
        if (tab === 'top')         return seg === 'top';
        return true;
      });
    }

    // Filtro por estado
    if (filtroEstado) {
      list = list.filter(c => c.estado === filtroEstado);
    }

    // Búsqueda client-side
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(c =>
        (c.nombre ?? '').toLowerCase().includes(q) ||
        (c.apellido ?? '').toLowerCase().includes(q) ||
        (c.razon_social ?? '').toLowerCase().includes(q) ||
        (c.telefono ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.localidad ?? '').toLowerCase().includes(q) ||
        (c.documento_nro ?? '').toLowerCase().includes(q)
      );
    }

    // Ordenar
    list.sort((a, b) => {
      if (orden === 'ultima_actividad') return a.dias_sin_contacto - b.dias_sin_contacto;
      if (orden === 'mayor_compra')     return b.valor_total_historico - a.valor_total_historico;
      if (orden === 'mas_reciente')     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (orden === 'nombre')           return nombreDisplay(a).localeCompare(nombreDisplay(b), 'es');
      return 0;
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, tab, busqueda, orden, topIds, filtroEstado]);

  const totalPages = Math.ceil(filtrado.length / PER_PAGE);
  const paginated  = filtrado.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleTab(t: TabFilter) { setTab(t); setPage(1); }
  function handleBusqueda(q: string) { setBusqueda(q); setPage(1); }

  function exportarCSV() {
    const headers = ['Nombre', 'Tipo', 'Teléfono', 'Email', 'Localidad', 'Estado', 'Operaciones', 'Compras totales'];
    const rows = filtrado.map(c => [
      nombreDisplay(c),
      c.tipo_persona === 'juridica' ? 'Empresa' : 'Persona',
      c.telefono ?? '',
      c.email ?? '',
      c.localidad ?? '',
      c.estado,
      c.operaciones_count,
      c.valor_total_historico,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const { stats, oportunidades, por_localidad, actividad_reciente, resumen } = data ?? {
    stats: { total: 0, activos: 0, sin_actividad: 0, nuevos_mes: 0, total_facturado_mes: 0, clientes_top: 0 },
    oportunidades: { sin_contacto_30d: 0, presupuestos_sin_respuesta: 0, pagos_vencidos: 0, para_seguimiento: 0 },
    por_localidad: [], actividad_reciente: [],
    resumen: { sin_actividad_60d: 0, mayor_compra: null, mejor_cliente_mes: null, ticket_promedio_mes: 0, ticket_trend: 0 },
  };

  const TABS: { key: TabFilter; label: string }[] = [
    { key: 'todos',       label: 'Todos' },
    { key: 'activos',     label: 'Activos' },
    { key: 'seguimiento', label: 'En seguimiento' },
    { key: 'nuevos',      label: 'Nuevos' },
    { key: 'inactivos',   label: 'Inactivos' },
    { key: 'top',         label: 'Top clientes' },
  ];

  const ORDEN_LABELS: Record<Orden, string> = {
    ultima_actividad: 'Última actividad',
    mayor_compra:     'Mayor compra',
    mas_reciente:     'Más reciente',
    nombre:           'Nombre',
  };

  const KPIS = [
    { label: 'Total clientes',     valor: stats.total,               sub: 'Todos los clientes',       icon: Users,      color: 'text-sky-600',     bg: 'bg-sky-50' },
    { label: 'Clientes activos',   valor: stats.activos,             sub: 'Con actividad reciente',   icon: Users,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Sin actividad',      valor: stats.sin_actividad,       sub: 'Más de 60 días',           icon: Clock,      color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'Nuevos este mes',    valor: stats.nuevos_mes,          sub: '+20% vs mes anterior',     icon: UserPlus,   color: 'text-violet-600',  bg: 'bg-violet-50' },
    { label: 'Total facturado (mes)', valor: formatCurrency(stats.total_facturado_mes), sub: `De ${stats.total} clientes`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', isCurrency: true },
    { label: 'Clientes top (mes)', valor: stats.clientes_top,        sub: 'Generan mayor volumen',    icon: Star,       color: 'text-amber-600',   bg: 'bg-amber-50' },
  ];

  const OPO_ITEMS = [
    {
      icon: MessageCircle,
      color: 'text-emerald-600 bg-emerald-50',
      label: `Escribir a ${oportunidades.sin_contacto_30d} clientes`,
      sub: 'Sin contacto hace más de 30 días',
      count: oportunidades.sin_contacto_30d,
      action: () => handleTab('inactivos'),
    },
    {
      icon: FileText,
      color: 'text-amber-600 bg-amber-50',
      label: `${oportunidades.presupuestos_sin_respuesta} presupuestos sin respuesta`,
      sub: 'Más de 3 días sin respuesta',
      count: oportunidades.presupuestos_sin_respuesta,
      action: () => navigate('/presupuestos'),
    },
    {
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
      label: `${oportunidades.pagos_vencidos} pagos vencidos`,
      sub: 'Compromisos de pago atrasados',
      count: oportunidades.pagos_vencidos,
      action: () => navigate('/recibos'),
    },
    {
      icon: Users,
      color: 'text-sky-600 bg-sky-50',
      label: `${oportunidades.para_seguimiento} clientes para seguimiento`,
      sub: 'Estado: prospecto',
      count: oportunidades.para_seguimiento,
      action: () => handleTab('seguimiento'),
    },
  ];

  const ACT_ICONS: Record<string, { Icon: React.ElementType; color: string }> = {
    interaccion: { Icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
    recibo:      { Icon: Receipt,       color: 'text-sky-600 bg-sky-50' },
    operacion:   { Icon: FileText,      color: 'text-amber-600 bg-amber-50' },
  };

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">Gestión de clientes y oportunidades</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportarCSV}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold">
            <Download size={14} /> Exportar
          </button>
          <button onClick={() => navigate('/clientes/importar')}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold">
            <Upload size={14} /> Importador
          </button>
          <button onClick={() => navigate('/clientes/nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={14} /> Nuevo cliente
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-6 gap-3">
        {KPIS.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', k.bg)}>
                <Icon size={18} className={k.color} />
              </div>
              <p className="text-[11px] text-gray-500 mb-0.5">{k.label}</p>
              <p className={cn('font-bold tabular-nums', loading ? 'text-gray-300' : 'text-gray-900',
                k.isCurrency ? 'text-base' : 'text-2xl')}>
                {k.isCurrency ? k.valor : k.valor}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Layout */}
      <div className="flex gap-4 items-start">

        {/* Columna principal */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Tabs + ordenar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {TABS.map(t => {
                  const count = conteos[t.key as keyof typeof conteos];
                  const isInactivo = t.key === 'inactivos' && tab !== 'inactivos' && conteos.inactivos > 0;
                  return (
                    <button key={t.key} onClick={() => handleTab(t.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        tab === t.key
                          ? t.key === 'inactivos' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
                          : isInactivo ? 'text-red-600 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-100'
                      )}>
                      {t.label}
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                        tab === t.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500')}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Ordenar por */}
              <div className="relative" ref={ordenRef}>
                <button onClick={() => setOrdenOpen(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Ordenar por: <span className="text-gray-900">{ORDEN_LABELS[orden]}</span>
                </button>
                {ordenOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 w-44">
                    {(Object.entries(ORDEN_LABELS) as [Orden, string][]).map(([k, label]) => (
                      <button key={k} onClick={() => { setOrden(k); setOrdenOpen(false); }}
                        className={cn('w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors',
                          orden === k ? 'font-semibold text-emerald-700' : 'text-gray-700')}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Búsqueda + filtros */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={busqueda} onChange={e => handleBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, teléfono, DNI/CUIT, correo, localidad..."
                  className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                {busqueda && (
                  <button onClick={() => handleBusqueda('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
                className={cn(
                  'px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400',
                  filtroEstado ? 'border-emerald-400 text-emerald-700 font-medium' : 'border-gray-200 text-gray-600'
                )}>
                <option value="">Todos los estados</option>
                <option value="prospecto">Prospecto</option>
                <option value="activo">Activo</option>
                <option value="recurrente">Cliente VIP</option>
                <option value="inactivo">Inactivo</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Cabecera */}
            <div className="grid gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
              style={{ gridTemplateColumns: '1fr 160px 120px 130px 120px 110px 120px 80px' }}>
              <span>Cliente</span>
              <span>Contacto</span>
              <span>Segmento</span>
              <span>Última actividad</span>
              <span>Compras</span>
              <span>Ticket prom.</span>
              <span>Deuda</span>
              <span></span>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="px-4 py-4 animate-pulse flex gap-4">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-40" />
                      <div className="h-3 bg-gray-100 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">
                  {busqueda || tab !== 'todos' ? 'Sin resultados' : 'No hay clientes'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {paginated.map(c => {
                  const seg = efectivoSegmento(c);
                  const segCfg = SEG_CFG[seg];
                  const av = avatarColor(nombreDisplay(c));
                  const act = actividadInfo(c.dias_sin_contacto);
                  const waMsg = `Hola ${c.nombre ?? c.razon_social ?? ''}, te contactamos desde Aberturas.`;

                  return (
                    <div key={c.id}
                      className="grid gap-2 px-4 py-3.5 items-center hover:bg-gray-50/80 transition-colors cursor-pointer group"
                      style={{ gridTemplateColumns: '1fr 160px 120px 130px 120px 110px 120px 80px' }}
                      onClick={() => navigate(`/clientes/${c.id}`)}>

                      {/* Cliente */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0', av.bg, av.text)}>
                          {getInitials(c)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-emerald-700 transition-colors">
                              {nombreDisplay(c)}
                            </p>
                            {(seg === 'frecuente' || seg === 'top' || seg === 'nuevo') && (
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0', segCfg.bg, segCfg.text)}>
                                {segCfg.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            {c.documento_nro && (
                              <span>{c.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'} {c.documento_nro}</span>
                            )}
                            {c.localidad && <span>{c.localidad}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Contacto */}
                      <div className="min-w-0">
                        {c.telefono && <p className="text-xs text-gray-700 truncate">{c.telefono}</p>}
                        {c.email    && <p className="text-[10px] text-gray-400 truncate">{c.email}</p>}
                      </div>

                      {/* Segmento */}
                      <div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', segCfg.bg, segCfg.text)}>
                          {segCfg.label}
                        </span>
                      </div>

                      {/* Última actividad */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full shrink-0', act.dotColor)} />
                          <p className="text-xs font-medium text-gray-700">{act.label}</p>
                        </div>
                        {c.ultima_interaccion && (
                          <p className="text-[10px] text-gray-400 ml-3.5 mt-0.5">
                            {fmtFechaCorta(c.ultima_interaccion)}
                          </p>
                        )}
                      </div>

                      {/* Compras */}
                      <div>
                        <p className="text-xs font-bold text-gray-900">
                          {c.operaciones_count > 0 ? formatCurrency(c.valor_total_historico) : '—'}
                        </p>
                        <p className="text-[10px] text-gray-400">{c.operaciones_count} op.</p>
                      </div>

                      {/* Ticket promedio */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700">
                          {c.ticket_promedio > 0 ? formatCurrency(c.ticket_promedio) : '—'}
                        </p>
                      </div>

                      {/* Deuda */}
                      <div>
                        {c.total_deuda > 0 ? (
                          <>
                            <p className="text-xs font-bold text-red-600">{formatCurrency(c.total_deuda)}</p>
                            <p className="text-[10px] text-red-400">{c.count_deuda} pendiente{c.count_deuda !== 1 ? 's' : ''}</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-gray-400">Sin deuda</p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        {c.telefono && (
                          <a href={`https://wa.me/${c.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                            <MessageCircle size={14} />
                          </a>
                        )}
                        {c.telefono && (
                          <a href={`tel:${c.telefono}`}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                            <Phone size={14} />
                          </a>
                        )}
                        <button onClick={() => navigate(`/clientes/${c.id}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                          <History size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {filtrado.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Mostrando {(page - 1) * PER_PAGE + 1} a {Math.min(page * PER_PAGE, filtrado.length)} de {filtrado.length} clientes
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const n = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={cn('w-7 h-7 rounded-lg text-xs font-medium',
                          page === n ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 text-gray-600')}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Barra inferior — 4 tiles resumen */}
          <div className="grid grid-cols-4 gap-3">

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock size={15} className="text-amber-600" />
                </div>
                <p className="text-xs font-semibold text-gray-700">Clientes sin actividad</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{resumen.sin_actividad_60d}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Sin actividad en más de 60 días</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp size={15} className="text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-gray-700">Mayor compra (histórico)</p>
              </div>
              {resumen.mayor_compra ? (
                <>
                  <p className="text-sm font-bold text-gray-900 truncate">{resumen.mayor_compra.cliente_nombre}</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(resumen.mayor_compra.monto)}</p>
                  <p className="text-[10px] text-gray-400">{resumen.mayor_compra.operaciones} operaciones</p>
                </>
              ) : <p className="text-xs text-gray-400">Sin datos</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Star size={15} className="text-amber-600" />
                </div>
                <p className="text-xs font-semibold text-gray-700">Mejor cliente (este mes)</p>
              </div>
              {resumen.mejor_cliente_mes ? (
                <>
                  <p className="text-sm font-bold text-gray-900 truncate">{resumen.mejor_cliente_mes.cliente_nombre}</p>
                  <p className="text-lg font-bold text-amber-700">{formatCurrency(resumen.mejor_cliente_mes.monto)}</p>
                  <p className="text-[10px] text-gray-400">{resumen.mejor_cliente_mes.compras} compras</p>
                </>
              ) : <p className="text-xs text-gray-400">Sin datos</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                  {resumen.ticket_trend >= 0
                    ? <TrendingUp size={15} className="text-sky-600" />
                    : <TrendingDown size={15} className="text-red-500" />}
                </div>
                <p className="text-xs font-semibold text-gray-700">Ticket promedio (este mes)</p>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(resumen.ticket_promedio_mes)}</p>
              {resumen.ticket_trend !== 0 && (
                <p className={cn('text-[10px] font-semibold mt-0.5',
                  resumen.ticket_trend > 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {resumen.ticket_trend > 0 ? '+' : ''}{resumen.ticket_trend}% vs mes anterior
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-[260px] shrink-0 space-y-4">

          {/* Oportunidades para hoy */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">Oportunidades para hoy</p>
            </div>
            <div className="space-y-2">
              {OPO_ITEMS.filter(o => o.count > 0).map((o, i) => {
                const Icon = o.icon;
                return (
                  <button key={i} onClick={o.action}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', o.color)}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{o.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{o.sub}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-500 shrink-0 mt-0.5">{o.count}</span>
                  </button>
                );
              })}
              {OPO_ITEMS.every(o => o.count === 0) && (
                <p className="text-xs text-gray-400 text-center py-3">Sin oportunidades pendientes</p>
              )}
            </div>
          </div>

          {/* Clientes por localidad */}
          {por_localidad.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Clientes por localidad</p>
              <DonutChart data={por_localidad.map(l => ({ label: l.localidad, pct: l.pct, count: l.count }))} />
            </div>
          )}

          {/* Actividad reciente */}
          {actividad_reciente.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Actividad reciente</p>
              <div className="space-y-2.5">
                {actividad_reciente.map((a, i) => {
                  const cfg = ACT_ICONS[a.tipo] ?? ACT_ICONS.operacion;
                  const Icon = cfg.Icon;
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', cfg.color)}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-700 leading-tight line-clamp-2">{a.descripcion}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{fmtRelativa(a.fecha)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
