import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, TrendingUp, Clock, Plus, ArrowRight,
  Hammer, CheckCircle2, DollarSign, AlertCircle, Layers
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  entregado: 'Entregado', cancelado: 'Cancelado',
};

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-slate-100 text-slate-600',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
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

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ presupuestos_activos: 0, ventas_mes: 0, monto_mes: 0, clientes_total: 0 });
  const [recientes, setRecientes] = useState<Operacion[]>([]);
  const [pendientes, setPendientes] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [
      { count: presupuestos_activos },
      { data: ventasMes },
      { count: clientes_total },
      { data: ultimasOps },
      { data: opsPendientes },
    ] = await Promise.all([
      supabase.from('operaciones').select('*', { count: 'exact', head: true }).in('estado', ['presupuesto', 'enviado', 'aprobado']),
      supabase.from('operaciones').select('precio_total').in('estado', ['aprobado', 'en_produccion', 'listo', 'instalado', 'entregado']).gte('created_at', primerDiaMes),
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('operaciones').select('*, cliente:clientes(nombre, apellido)').order('created_at', { ascending: false }).limit(5),
      supabase.from('operaciones').select('*, cliente:clientes(nombre, apellido)').in('estado', ['presupuesto', 'enviado']).order('created_at', { ascending: true }).limit(5),
    ]);
    const monto_mes = (ventasMes ?? []).reduce((s, o) => s + (o.precio_total ?? 0), 0);
    setStats({ presupuestos_activos: presupuestos_activos ?? 0, ventas_mes: (ventasMes ?? []).length, monto_mes, clientes_total: clientes_total ?? 0 });
    setRecientes((ultimasOps ?? []) as unknown as Operacion[]);
    setPendientes((opsPendientes ?? []) as unknown as Operacion[]);
    setLoading(false);
  }

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saludo}, {profile?.nombre ?? 'usuario'} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link to="/presupuestos/nuevo"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md">
          <Plus size={16} /> Nuevo presupuesto
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-28 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Presupuestos activos" value={stats.presupuestos_activos} icon={FileText}   gradient="from-violet-500 to-violet-600" href="/presupuestos" />
          <StatCard label="Ventas este mes"       value={stats.ventas_mes}           icon={CheckCircle2} gradient="from-emerald-500 to-emerald-600" />
          <StatCard label="Facturado mes"          value={formatCurrency(stats.monto_mes)} icon={DollarSign}  gradient="from-blue-500 to-blue-600" />
          <StatCard label="Clientes activos"       value={stats.clientes_total}       icon={Users}     gradient="from-amber-500 to-orange-500"  href="/clientes" />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/presupuestos/nuevo', label: 'Nuevo presupuesto', icon: FileText,  color: 'text-violet-600', bg: 'bg-violet-50 hover:bg-violet-100 border-violet-100' },
          { to: '/clientes/nuevo',     label: 'Nuevo cliente',     icon: Users,     color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100' },
          { to: '/productos/nuevo',    label: 'Nuevo producto',    icon: Layers,    color: 'text-sky-600',     bg: 'bg-sky-50 hover:bg-sky-100 border-sky-100' },
          { to: '/operaciones',        label: 'Ver operaciones',   icon: Hammer,    color: 'text-amber-600',   bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100' },
        ].map(({ to, label, icon: Icon, color, bg }) => (
          <Link key={to} to={to} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center ${bg}`}>
            <Icon size={20} className={color} />
            <span className={`text-xs font-medium ${color}`}>{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard
          title="Pendientes de seguimiento"
          subtitle={pendientes.length > 0 ? `${pendientes.length} esperando respuesta` : undefined}
          subtitleColor="text-amber-600"
          iconBg="bg-amber-100"
          icon={<Clock size={15} className="text-amber-600" />}
          href="/presupuestos"
          hrefLabel="Ver todos"
          empty={pendientes.length === 0}
          emptyIcon={<CheckCircle2 size={22} className="text-green-500" />}
          emptyBg="bg-green-50"
          emptyTitle="Todo al día"
          emptyDesc="Sin presupuestos pendientes"
        >
          {pendientes.map(op => (
            <Link key={op.id} to={`/operaciones/${op.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors border-b border-gray-50 last:border-0 group">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{(op.cliente as any)?.nombre} {(op.cliente as any)?.apellido ?? ''}</p>
                <p className="text-xs text-gray-400 mt-0.5">{op.numero} · {TIPO_LABEL[op.tipo]} · {formatDate(op.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[op.estado]}`}>{ESTADO_LABEL[op.estado]}</span>
                <p className="text-sm font-bold text-gray-700 mt-1">{formatCurrency(op.precio_total)}</p>
              </div>
              <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
            </Link>
          ))}
        </SectionCard>

        <SectionCard
          title="Últimas operaciones"
          subtitle="Actividad reciente"
          iconBg="bg-amber-100"
          icon={<Hammer size={15} className="text-amber-600" />}
          href="/operaciones"
          hrefLabel="Ver todas"
          empty={recientes.length === 0}
          emptyIcon={<AlertCircle size={22} className="text-amber-400" />}
          emptyBg="bg-amber-50"
          emptyTitle="Sin operaciones aún"
          emptyDesc="Crear la primera"
          emptyHref="/presupuestos/nuevo"
        >
          {recientes.map(op => (
            <Link key={op.id} to={`/operaciones/${op.id}`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors border-b border-gray-50 last:border-0 group">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Hammer size={14} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{(op.cliente as any)?.nombre} {(op.cliente as any)?.apellido ?? ''}</p>
                <p className="text-xs text-gray-400 mt-0.5">{op.numero} · {TIPO_LABEL[op.tipo]}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[op.estado]}`}>{ESTADO_LABEL[op.estado]}</span>
                <p className="text-sm font-bold text-gray-700 mt-1">{formatCurrency(op.precio_total)}</p>
              </div>
              <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
            </Link>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, gradient, href }: {
  label: string; value: string | number; icon: React.ElementType; gradient: string; href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card hover:shadow-soft transition-all group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
          <Icon size={18} className="text-white" />
        </div>
        {href && <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-2 font-medium">{label}</p>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : <div>{inner}</div>;
}

function SectionCard({ title, subtitle, subtitleColor = 'text-gray-400', iconBg, icon, href, hrefLabel, empty, emptyIcon, emptyBg, emptyTitle, emptyDesc, emptyHref, children }: {
  title: string; subtitle?: string; subtitleColor?: string; iconBg: string; icon: React.ReactNode;
  href: string; hrefLabel: string; empty: boolean; emptyIcon: React.ReactNode; emptyBg: string;
  emptyTitle: string; emptyDesc: string; emptyHref?: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className={`text-xs ${subtitleColor}`}>{subtitle}</p>}
          </div>
        </div>
        <Link to={href} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
          {hrefLabel} <ArrowRight size={12} />
        </Link>
      </div>
      {empty ? (
        <div className="px-5 py-10 text-center">
          <div className={`w-12 h-12 rounded-2xl ${emptyBg} flex items-center justify-center mx-auto mb-3`}>{emptyIcon}</div>
          <p className="text-sm font-medium text-gray-600">{emptyTitle}</p>
          {emptyHref
            ? <Link to={emptyHref} className="text-xs text-brand-600 hover:underline mt-0.5 block">{emptyDesc}</Link>
            : <p className="text-xs text-gray-400 mt-0.5">{emptyDesc}</p>
          }
        </div>
      ) : children}
    </div>
  );
}
