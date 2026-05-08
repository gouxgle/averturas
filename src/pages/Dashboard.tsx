import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Plus, Receipt, Package, ArrowRight,
  Phone, CreditCard, Truck, CalendarClock,
  TrendingUp, Users, Target, DollarSign,
  AlertTriangle, CheckCircle2, Sparkles,
  MessageCircle, Clock, Box, Zap, ChevronRight,
  ShoppingBag, BarChart2, Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

// ── Tipos ───────────────────────────────────────────────────────────

interface Stats {
  presupuestos_activos: number;
  ventas_mes: number;
  monto_mes: number;
  ventas_hoy: number;
  clientes_total: number;
  prospectos: number;
  sin_contacto_30: number;
  tareas_vencidas: number;
}

interface OpItem {
  id: string;
  numero: string;
  precio_total: number;
  estado: string;
  created_at: string;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

interface Compromiso {
  id: string;
  monto: number;
  fecha_vencimiento: string;
  tipo: string;
  descripcion: string | null;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
  operacion: { id: string; numero: string } | null;
}

interface StockBajo {
  id: string;
  nombre: string;
  stock_minimo: number;
  stock_actual: number;
}

interface TopProducto {
  descripcion: string;
  veces_vendido: number;
  unidades: number;
  monto_total: number;
}

interface ContactoCliente {
  id: string;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  tipo_persona: string;
  telefono: string | null;
  estado: string;
  dias_sin_contacto: number;
}

interface DashboardResumen {
  stats: Stats;
  sin_confirmar: OpItem[];
  sin_pago: OpItem[];
  pagados_no_entregados: OpItem[];
  compromisos_semana: Compromiso[];
  stock_bajo: StockBajo[];
  top_productos: TopProducto[];
  sin_contacto: ContactoCliente[];
  recientes: OpItem[];
}

// ── Helpers ─────────────────────────────────────────────────────────

function nombreCliente(c: OpItem['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit',
  });
}

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Borrador', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

const ESTADO_COLOR: Record<string, string> = {
  presupuesto: 'bg-gray-100 text-gray-600',
  enviado: 'bg-amber-100 text-amber-700',
  aprobado: 'bg-emerald-100 text-emerald-700',
  en_produccion: 'bg-blue-100 text-blue-700',
  listo: 'bg-teal-100 text-teal-700',
  instalado: 'bg-violet-100 text-violet-700',
  entregado: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-600',
};

// ── Sub-componentes ──────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, badge, color = 'bg-blue-600' }: {
  icon: React.ElementType; title: string; badge?: number; color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={13} className="text-white" />
      </div>
      <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex-1">{title}</h2>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </div>
  );
}

// Tarjeta de prioridad de acción
function PrioridadCard({ icon: Icon, title, count, desc, color, href }: {
  icon: React.ElementType; title: string; count: number; desc: string; color: string; href: string;
}) {
  const cls = {
    amber:  { bg: 'bg-amber-50',   border: 'border-amber-200',  icon: 'bg-amber-500',   text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    red:    { bg: 'bg-red-50',     border: 'border-red-200',    icon: 'bg-red-500',     text: 'text-red-700',   badge: 'bg-red-100 text-red-800' },
    sky:    { bg: 'bg-sky-50',     border: 'border-sky-200',    icon: 'bg-sky-500',     text: 'text-sky-700',   badge: 'bg-sky-100 text-sky-800' },
    orange: { bg: 'bg-orange-50',  border: 'border-orange-200', icon: 'bg-orange-500',  text: 'text-orange-700',badge: 'bg-orange-100 text-orange-800' },
  }[color] ?? { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'bg-gray-500', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' };

  return (
    <Link
      to={href}
      className={`flex items-center gap-3 p-3.5 rounded-xl border ${cls.bg} ${cls.border} hover:shadow-sm transition-all`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls.icon}`}>
        <Icon size={17} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold ${cls.text} truncate`}>{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{desc}</p>
      </div>
      <span className={`text-lg font-extrabold tabular-nums ${cls.text} shrink-0`}>{count}</span>
    </Link>
  );
}

// Métrica KPI
function MetricaCard({ icon: Icon, title, value, sub, color }: {
  icon: React.ElementType; title: string; value: string; sub: string; color: string;
}) {
  const cls = {
    blue:   { icon: 'text-blue-500',   bar: 'bg-blue-500',   bg: 'bg-blue-50' },
    violet: { icon: 'text-violet-500', bar: 'bg-violet-500', bg: 'bg-violet-50' },
    emerald:{ icon: 'text-emerald-500',bar: 'bg-emerald-500',bg: 'bg-emerald-50' },
    teal:   { icon: 'text-teal-500',   bar: 'bg-teal-500',   bg: 'bg-teal-50' },
  }[color] ?? { icon: 'text-gray-500', bar: 'bg-gray-500', bg: 'bg-gray-50' };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cls.bg}`}>
          <Icon size={14} className={cls.icon} />
        </div>
        <span className="text-[11px] font-medium text-gray-500 truncate">{title}</span>
      </div>
      <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
      <div className="mt-2.5 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${cls.bar} rounded-full w-3/5`} />
      </div>
    </div>
  );
}

// Skeleton
function Skeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── Dashboard principal ──────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardResumen>('/dashboard/resumen')
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const enviados = data ? data.sin_confirmar.filter(o => o.estado === 'enviado').length : 0;

  return (
    <div className="page-enter p-5 max-w-[1280px] mx-auto space-y-5">

      {/* ── Encabezado ───────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden px-6 py-5"
        style={{
          background: 'linear-gradient(135deg, #031d49 0%, #0d3a8a 60%, #1a4fa0 100%)',
          boxShadow: '0 8px 32px -4px rgba(3,29,73,0.28)',
        }}
      >
        <svg className="absolute right-0 top-0 opacity-[0.07]" width="200" height="140" viewBox="0 0 200 140" fill="none">
          <rect x="110" y="10" width="60" height="52" rx="7" fill="white" />
          <rect x="110" y="70" width="60" height="52" rx="7" fill="white" />
          <rect x="20" y="10" width="78" height="112" rx="7" fill="white" opacity="0.5" />
        </svg>
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={13} className="text-yellow-300 opacity-80" />
              <span className="text-[11px] font-medium capitalize" style={{ color: 'rgba(255,255,255,0.5)' }}>{fechaHoy}</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {saludo}, {user?.nombre ?? 'usuario'}
            </h1>
            <p className="text-sm mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Panel de control · César Brítez Aberturas
            </p>
          </div>
          <Link
            to="/presupuestos/nuevo"
            className="flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shrink-0"
            style={{ background: '#e31e24', color: '#fff', boxShadow: '0 4px 14px rgba(227,30,36,0.3)' }}
          >
            <Plus size={15} /> Nuevo presupuesto
          </Link>
        </div>
      </div>

      {/* ── Accesos rápidos ──────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { to: '/presupuestos/nuevo', label: 'Nuevo presupuesto', icon: FileText, iconCls: 'text-violet-600', bg: 'bg-violet-50 border-violet-100', hov: 'hover:bg-violet-100 hover:border-violet-200' },
          { to: '/recibos/nuevo',      label: 'Nuevo recibo',      icon: Receipt,  iconCls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', hov: 'hover:bg-emerald-100 hover:border-emerald-200' },
          { to: '/remitos',            label: 'Remitos',           icon: Package,  iconCls: 'text-sky-600',     bg: 'bg-sky-50 border-sky-100',        hov: 'hover:bg-sky-100 hover:border-sky-200' },
          { to: '/presupuestos',       label: 'Presupuestos',      icon: ArrowRight,iconCls: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100',    hov: 'hover:bg-amber-100 hover:border-amber-200' },
        ].map(({ to, label, icon: Icon, iconCls, bg, hov }) => (
          <Link key={to} to={to} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${bg} ${hov}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm shrink-0">
              <Icon size={16} className={iconCls} />
            </div>
            <span className={`text-xs font-semibold ${iconCls} leading-tight`}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Contenido principal (2 columnas) ────────────────────── */}
      {loading ? (
        <div className="flex gap-5 items-start">
          <div className="flex-1"><Skeleton /></div>
          <div className="w-72 shrink-0 animate-pulse space-y-4">
            <div className="h-48 bg-gray-100 rounded-xl" />
            <div className="h-36 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
        </div>
      ) : data && (
        <div className="flex gap-5 items-start">

          {/* ── Columna principal ─────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* PRIORIDADES DE HOY */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <SectionHeader icon={Zap} title="Prioridades de hoy" color="bg-amber-500" />
              <div className="grid grid-cols-2 gap-2.5">
                <PrioridadCard
                  icon={Phone}
                  title="Presupuestos enviados"
                  count={enviados}
                  desc="Llamar y hacer seguimiento"
                  color="amber"
                  href="/presupuestos"
                />
                <PrioridadCard
                  icon={CreditCard}
                  title="Cobros pendientes"
                  count={data.sin_pago.length}
                  desc="Solicitar pago a clientes"
                  color="red"
                  href="/presupuestos"
                />
                <PrioridadCard
                  icon={Truck}
                  title="Entregas pendientes"
                  count={data.pagados_no_entregados.length}
                  desc="Coordinar entrega o retiro"
                  color="sky"
                  href="/remitos"
                />
                <PrioridadCard
                  icon={CalendarClock}
                  title="Compromisos esta semana"
                  count={data.compromisos_semana.length}
                  desc="Gestionar cobros comprometidos"
                  color="orange"
                  href="/presupuestos"
                />
              </div>
            </div>

            {/* NÚMEROS CLAVE */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <SectionHeader icon={BarChart2} title="Números clave del negocio" color="bg-blue-600" />
              <div className="grid grid-cols-2 gap-3">
                <MetricaCard
                  icon={DollarSign}
                  title="Ventas del mes"
                  value={formatCurrency(data.stats.monto_mes)}
                  sub={`${data.stats.ventas_mes} operaciones cerradas`}
                  color="blue"
                />
                <MetricaCard
                  icon={FileText}
                  title="Presupuestos activos"
                  value={String(data.stats.presupuestos_activos)}
                  sub="En proceso (borrador + enviado + aprobado)"
                  color="violet"
                />
                <MetricaCard
                  icon={Users}
                  title="Clientes activos"
                  value={String(data.stats.clientes_total)}
                  sub={`${data.stats.prospectos} prospectos en cartera`}
                  color="emerald"
                />
                <MetricaCard
                  icon={Target}
                  title="Tasa de conversión"
                  value={
                    data.stats.presupuestos_activos + data.stats.ventas_mes > 0
                      ? `${Math.round((data.stats.ventas_mes / (data.stats.ventas_mes + data.stats.presupuestos_activos)) * 100)}%`
                      : '—'
                  }
                  sub={`${formatCurrency(data.stats.ventas_hoy)} vendido hoy`}
                  color="teal"
                />
              </div>
            </div>

            {/* VENTAS EN RIESGO + SEGUIMIENTO */}
            <div className="grid grid-cols-2 gap-4">

              {/* Ventas en riesgo */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <SectionHeader
                  icon={AlertTriangle}
                  title="Ventas en riesgo"
                  badge={data.sin_confirmar.filter(o => o.estado === 'enviado' && diasDesde(o.created_at) > 5).length}
                  color="bg-red-500"
                />
                {data.sin_confirmar.filter(o => o.estado === 'enviado').length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={18} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-xs text-gray-400">Sin presupuestos enviados en espera</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {data.sin_confirmar
                      .filter(o => o.estado === 'enviado')
                      .map(op => {
                        const dias = diasDesde(op.created_at);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => navigate(`/presupuestos?id=${op.id}`)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{nombreCliente(op.cliente)}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{op.numero}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-gray-900 tabular-nums">{formatCurrency(Number(op.precio_total))}</p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dias > 7 ? 'bg-red-100 text-red-700' : dias > 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                {dias}d
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Seguimiento automático */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <SectionHeader
                  icon={MessageCircle}
                  title="Seguimiento automático"
                  badge={data.sin_contacto.length}
                  color="bg-violet-500"
                />
                {data.sin_contacto.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={18} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-xs text-gray-400">Todos los clientes con contacto reciente</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {data.sin_contacto.map(cl => {
                      const nombre = cl.tipo_persona === 'juridica'
                        ? (cl.razon_social ?? '—')
                        : [cl.apellido, cl.nombre].filter(Boolean).join(', ') || '—';
                      const waLink = cl.telefono
                        ? `https://wa.me/${cl.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${cl.nombre ?? ''}, te contactamos desde César Brítez Aberturas.`)}`
                        : null;
                      return (
                        <div key={cl.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{nombre}</p>
                            <p className="text-[10px] text-gray-400">{cl.dias_sin_contacto} días sin contacto</p>
                          </div>
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 flex items-center justify-center transition-colors shrink-0"
                              title="Contactar por WhatsApp"
                            >
                              <MessageCircle size={13} className="text-green-600" />
                            </a>
                          ) : (
                            <Link
                              to={`/clientes/${cl.id}`}
                              className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 flex items-center justify-center transition-colors shrink-0"
                            >
                              <ChevronRight size={13} className="text-violet-600" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* PRODUCTOS MÁS VENDIDOS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <SectionHeader icon={ShoppingBag} title="Productos más vendidos (últimos 3 meses)" color="bg-teal-600" />
              {data.top_productos.length === 0 ? (
                <div className="py-6 text-center">
                  <Box size={18} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">Sin datos de ventas por producto aún</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {data.top_productos.map((p, i) => {
                    const colors = ['border-teal-400', 'border-blue-400', 'border-violet-400', 'border-amber-400'];
                    const bgs = ['bg-teal-50', 'bg-blue-50', 'bg-violet-50', 'bg-amber-50'];
                    const texts = ['text-teal-700', 'text-blue-700', 'text-violet-700', 'text-amber-700'];
                    return (
                      <div
                        key={p.descripcion}
                        className={`flex gap-3 p-3 rounded-xl border-l-4 ${colors[i] ?? 'border-gray-300'} bg-gray-50 border border-gray-100`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgs[i] ?? 'bg-gray-100'}`}>
                          <span className={`text-sm font-black ${texts[i] ?? 'text-gray-600'}`}>{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate leading-tight">{p.descripcion}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{p.veces_vendido}× vendido · {p.unidades} u.</p>
                          <p className={`text-xs font-bold mt-1 ${texts[i] ?? 'text-gray-700'}`}>
                            {formatCurrency(Number(p.monto_total))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <div className="w-72 xl:w-80 shrink-0 space-y-4">

            {/* SUGERENCIAS DEL SISTEMA */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <SectionHeader icon={Sparkles} title="Sugerencias del sistema" color="bg-violet-500" />
              <div className="space-y-2.5">
                {[
                  data.stats.sin_contacto_30 > 0 && {
                    icon: Users, color: 'text-violet-500', bg: 'bg-violet-50',
                    text: `${data.stats.sin_contacto_30} cliente${data.stats.sin_contacto_30 > 1 ? 's' : ''} sin contacto hace +30 días`,
                  },
                  enviados > 2 && {
                    icon: Phone, color: 'text-amber-500', bg: 'bg-amber-50',
                    text: `${enviados} presupuestos enviados sin respuesta — hacer seguimiento`,
                  },
                  data.stats.tareas_vencidas > 0 && {
                    icon: Clock, color: 'text-red-500', bg: 'bg-red-50',
                    text: `${data.stats.tareas_vencidas} tarea${data.stats.tareas_vencidas > 1 ? 's' : ''} vencida${data.stats.tareas_vencidas > 1 ? 's' : ''} pendiente${data.stats.tareas_vencidas > 1 ? 's' : ''}`,
                  },
                  data.compromisos_semana.length > 0 && {
                    icon: CalendarClock, color: 'text-orange-500', bg: 'bg-orange-50',
                    text: `${data.compromisos_semana.length} compromiso${data.compromisos_semana.length > 1 ? 's' : ''} de pago vence${data.compromisos_semana.length === 1 ? '' : 'n'} esta semana`,
                  },
                  data.pagados_no_entregados.length > 0 && {
                    icon: Truck, color: 'text-sky-500', bg: 'bg-sky-50',
                    text: `${data.pagados_no_entregados.length} pedido${data.pagados_no_entregados.length > 1 ? 's' : ''} pagado${data.pagados_no_entregados.length > 1 ? 's' : ''} esperando entrega`,
                  },
                ].filter(Boolean).slice(0, 4).map((s, i) => {
                  if (!s) return null;
                  const Ico = (s as { icon: React.ElementType; color: string; bg: string; text: string }).icon;
                  const { color, bg, text } = s as { icon: React.ElementType; color: string; bg: string; text: string };
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                        <Ico size={12} className={color} />
                      </div>
                      <p className="text-[12px] text-gray-600 leading-snug">{text}</p>
                    </div>
                  );
                })}
                {[data.stats.sin_contacto_30, enviados, data.stats.tareas_vencidas, data.compromisos_semana.length, data.pagados_no_entregados.length].every(v => v === 0) && (
                  <div className="py-4 text-center">
                    <CheckCircle2 size={18} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-xs text-gray-400">¡Todo bajo control!</p>
                  </div>
                )}
              </div>
            </div>

            {/* PROBLEMAS OPERATIVOS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <SectionHeader icon={AlertTriangle} title="Problemas operativos" color="bg-red-500" />
              <div className="space-y-2">
                {[
                  { label: 'Stock bajo o agotado', count: data.stock_bajo.length, color: 'red', href: '/stock' },
                  { label: 'Aprobados sin cobro', count: data.sin_pago.length, color: 'orange', href: '/presupuestos' },
                  { label: 'Tareas vencidas', count: data.stats.tareas_vencidas, color: 'rose', href: '/clientes' },
                  { label: 'Sin confirmar >7 días', count: data.sin_confirmar.filter(o => diasDesde(o.created_at) > 7).length, color: 'amber', href: '/presupuestos' },
                ].map(({ label, count, color, href }) => {
                  const cls = {
                    red:    { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-400' },
                    orange: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
                    rose:   { badge: 'bg-rose-100 text-rose-700',  dot: 'bg-rose-400' },
                    amber:  { badge: 'bg-amber-100 text-amber-700',dot: 'bg-amber-400' },
                  }[color] ?? { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                  return (
                    <Link
                      key={label}
                      to={href}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${count > 0 ? cls.dot : 'bg-emerald-400'}`} />
                      <span className="flex-1 text-xs text-gray-600">{label}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${count > 0 ? cls.badge : 'bg-emerald-100 text-emerald-700'}`}>
                        {count}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ACTIVIDAD RECIENTE */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <SectionHeader icon={Activity} title="Actividad reciente" color="bg-gray-600" />
              {data.recientes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin actividad registrada</p>
              ) : (
                <div className="space-y-1">
                  {data.recientes.map((op, i) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => navigate(`/presupuestos?id=${op.id}`)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                        {i < data.recientes.length - 1 && <div className="w-px h-3 bg-gray-100 mt-0.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-800 truncate">{nombreCliente(op.cliente)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-gray-400">{op.numero}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full ${ESTADO_COLOR[op.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ESTADO_LABEL[op.estado] ?? op.estado}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-gray-700 tabular-nums shrink-0">
                        {formatCurrency(Number(op.precio_total))}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <Link to="/presupuestos" className="flex items-center justify-center gap-1 mt-3 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                Ver todas <ChevronRight size={12} />
              </Link>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
