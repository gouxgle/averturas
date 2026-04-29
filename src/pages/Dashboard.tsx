import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, Clock, Plus, ArrowRight,
  Hammer, CheckCircle2, DollarSign, AlertCircle, Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Operacion } from '@/types';

interface Stats {
  presupuestos_activos: number;
  ventas_mes: number;
  monto_mes: number;
  clientes_total: number;
}

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Borrador', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado',
  entregado: 'Entregado', cancelado: 'Cancelado', rechazado: 'Rechazado',
};

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-slate-100 text-slate-600',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  rechazado:     'bg-red-100 text-red-600',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-emerald-100 text-emerald-700',
  cancelado:     'bg-red-100 text-red-700',
};

const TIPO_LABEL: Record<string, string> = {
  estandar: 'Estándar',
  a_medida_proveedor: 'A medida',
  fabricacion_propia: 'Fabricación',
};

/** Skeleton de cards KPI */
function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white/80 rounded-2xl border border-white p-5 h-[112px] shadow-card">
          <div className="skeleton w-10 h-10 rounded-xl mb-4" />
          <div className="skeleton h-7 w-16 mb-2" />
          <div className="skeleton h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats,    setStats]    = useState<Stats>({ presupuestos_activos: 0, ventas_mes: 0, monto_mes: 0, clientes_total: 0 });
  const [recientes, setRecientes] = useState<Operacion[]>([]);
  const [pendientes, setPendientes] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Stats>('/dashboard/stats'),
      api.get<Operacion[]>('/dashboard/recientes'),
      api.get<Operacion[]>('/dashboard/pendientes'),
    ]).then(([s, r, p]) => {
      setStats(s);
      setRecientes(r);
      setPendientes(p);
      setLoading(false);
    });
  }, []);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const fechaHoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Encabezado ───────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden px-6 py-5 fade-in"
        style={{
          background: 'linear-gradient(135deg, #031d49 0%, #0d3a8a 60%, #1a4fa0 100%)',
          boxShadow: '0 8px 32px -4px rgba(3,29,73,0.32)',
        }}
      >
        {/* Decoración ventana — marco esquina superior derecha */}
        <svg
          className="absolute right-0 top-0 opacity-[0.07]"
          width="220" height="160" viewBox="0 0 220 160" fill="none"
        >
          <rect x="130" y="10" width="70" height="60" rx="8" fill="white" />
          <rect x="210" y="10" width="1" height="140" fill="white" />
          <rect x="130" y="80" width="70" height="60" rx="8" fill="white" />
          <rect x="130" y="10" width="1" height="130" fill="white" />
          <rect x="130" y="75" width="80" height="1" fill="white" />
          <rect x="20" y="10" width="90" height="130" rx="8" fill="white" opacity="0.5" />
        </svg>

        <div className="relative flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-yellow-300 opacity-80" />
              <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.55)' }}>{fechaHoy}</span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {saludo}, {user?.nombre ?? 'usuario'}
            </h1>
            <p className="text-sm mt-0.5 font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Panel de control · César Brítez Aberturas
            </p>
          </div>
          <Link
            to="/presupuestos/nuevo"
            className="flex items-center gap-2 font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shrink-0"
            style={{
              background: '#e31e24',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(227,30,36,0.35)',
            }}
          >
            <Plus size={15} /> Nuevo presupuesto
          </Link>
        </div>
      </div>

      {/* ── Stats KPI ────────────────────────────────────────────── */}
      {loading ? <StatSkeleton /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Presupuestos activos" value={stats.presupuestos_activos} icon={FileText}    gradient="from-violet-500 to-violet-600" href="/presupuestos" delay="d1" />
          <StatCard label="Ventas este mes"       value={stats.ventas_mes}           icon={CheckCircle2} gradient="from-emerald-500 to-teal-500"  delay="d2" />
          <StatCard label="Facturado mes"          value={formatCurrency(stats.monto_mes)} icon={DollarSign} gradient="from-[#031d49] to-[#0d3a8a]" delay="d3" />
          <StatCard label="Clientes activos"       value={stats.clientes_total}       icon={Users}      gradient="from-amber-500 to-orange-500"  href="/clientes" delay="d4" />
        </div>
      )}

      {/* ── Accesos rápidos ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/presupuestos/nuevo', label: 'Nuevo presupuesto', icon: FileText, iconCls: 'text-violet-600',  bg: 'bg-violet-50 border-violet-100',  hov: 'hover:bg-violet-100 hover:border-violet-200' },
          { to: '/clientes/nuevo',     label: 'Nuevo cliente',     icon: Users,    iconCls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', hov: 'hover:bg-emerald-100 hover:border-emerald-200' },
          { to: '/productos/nuevo',    label: 'Nuevo producto',    icon: Layers,   iconCls: 'text-sky-600',     bg: 'bg-sky-50 border-sky-100',        hov: 'hover:bg-sky-100 hover:border-sky-200' },
          { to: '/operaciones',        label: 'Ver operaciones',   icon: Hammer,   iconCls: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100',    hov: 'hover:bg-amber-100 hover:border-amber-200' },
        ].map(({ to, label, icon: Icon, iconCls, bg, hov }, i) => (
          <Link
            key={to} to={to}
            className={`fade-in d${i + 1} flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all text-center card-lift ${bg} ${hov}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm`}>
              <Icon size={17} className={iconCls} />
            </div>
            <span className={`text-xs font-semibold ${iconCls}`}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Listas ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="fade-in d1">
          <SectionCard
            title="Pendientes de seguimiento"
            subtitle={pendientes.length > 0 ? `${pendientes.length} esperando respuesta` : undefined}
            subtitleColor="text-amber-600"
            accentColor="#f59e0b"
            icon={<Clock size={15} className="text-amber-600" />}
            href="/presupuestos"
            hrefLabel="Ver todos"
            empty={pendientes.length === 0}
            emptyIcon={<CheckCircle2 size={22} className="text-emerald-500" />}
            emptyBg="bg-emerald-50"
            emptyTitle="Todo al día"
            emptyDesc="Sin presupuestos pendientes"
          >
            {pendientes.map(op => <OperacionRow key={op.id} op={op} />)}
          </SectionCard>
        </div>

        <div className="fade-in d2">
          <SectionCard
            title="Últimas operaciones"
            subtitle="Actividad reciente"
            accentColor="#031d49"
            icon={<Hammer size={15} className="text-slate-600" />}
            href="/operaciones"
            hrefLabel="Ver todas"
            empty={recientes.length === 0}
            emptyIcon={<AlertCircle size={22} className="text-amber-400" />}
            emptyBg="bg-amber-50"
            emptyTitle="Sin operaciones aún"
            emptyDesc="Crear la primera"
            emptyHref="/presupuestos/nuevo"
          >
            {recientes.map(op => <OperacionRow key={op.id} op={op} />)}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, gradient, href, delay }: {
  label: string; value: string | number; icon: React.ElementType;
  gradient: string; href?: string; delay?: string;
}) {
  const inner = (
    <div className={`fade-in ${delay ?? ''} bg-white/90 rounded-2xl border border-white/80 p-5 shadow-card card-lift group cursor-pointer`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
          <Icon size={17} className="text-white" />
        </div>
        {href && (
          <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-500 transition-colors mt-1" />
        )}
      </div>
      <p className="text-2xl font-extrabold text-slate-800 leading-none tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-2 font-medium">{label}</p>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : <div>{inner}</div>;
}

function OperacionRow({ op }: { op: Operacion }) {
  const tipo = {
    estandar: 'Estándar',
    a_medida_proveedor: 'A medida',
    fabricacion_propia: 'Fabricación',
  }[op.tipo] ?? op.tipo;

  return (
    <Link
      to={`/operaciones/${op.id}`}
      className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0 group"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
        <FileText size={13} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {(op.cliente as any)?.apellido} {(op.cliente as any)?.nombre ?? ''}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {op.numero} · {tipo} · {formatDate(op.created_at)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[op.estado] ?? 'bg-slate-100 text-slate-500'}`}>
          {ESTADO_LABEL[op.estado] ?? op.estado}
        </span>
        <p className="text-sm font-bold text-slate-700 mt-1">{formatCurrency(op.precio_total)}</p>
      </div>
      <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
    </Link>
  );
}

function SectionCard({ title, subtitle, subtitleColor = 'text-slate-400', accentColor, icon, href, hrefLabel, empty, emptyIcon, emptyBg, emptyTitle, emptyDesc, emptyHref, children }: {
  title: string; subtitle?: string; subtitleColor?: string; accentColor: string;
  icon: React.ReactNode; href: string; hrefLabel: string;
  empty: boolean; emptyIcon: React.ReactNode; emptyBg: string;
  emptyTitle: string; emptyDesc: string; emptyHref?: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white/90 rounded-2xl border border-white/80 shadow-card overflow-hidden">
      {/* Header con borde-acento izquierdo */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-slate-50"
        style={{ borderLeft: `3px solid ${accentColor}` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">{icon}</div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {subtitle && <p className={`text-xs ${subtitleColor} font-medium`}>{subtitle}</p>}
          </div>
        </div>
        <Link
          to={href}
          className="text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-50"
          style={{ color: accentColor }}
        >
          {hrefLabel} <ArrowRight size={11} />
        </Link>
      </div>

      {empty ? (
        <div className="px-5 py-12 text-center">
          <div className={`w-12 h-12 rounded-2xl ${emptyBg} flex items-center justify-center mx-auto mb-3`}>
            {emptyIcon}
          </div>
          <p className="text-sm font-semibold text-slate-600">{emptyTitle}</p>
          {emptyHref
            ? <Link to={emptyHref} className="text-xs text-indigo-600 hover:underline mt-1 block">{emptyDesc}</Link>
            : <p className="text-xs text-slate-400 mt-1">{emptyDesc}</p>
          }
        </div>
      ) : children}
    </div>
  );
}
