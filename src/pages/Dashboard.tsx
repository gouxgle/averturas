import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Users, TrendingUp, Clock, Plus, ArrowRight, AlertCircle } from 'lucide-react';
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
  presupuesto:    'Presupuesto',
  enviado:        'Enviado',
  aprobado:       'Aprobado',
  en_produccion:  'En producción',
  listo:          'Listo',
  instalado:      'Instalado',
  entregado:      'Entregado',
  cancelado:      'Cancelado',
};

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-emerald-100 text-emerald-700',
  cancelado:     'bg-red-100 text-red-700',
};

const TIPO_LABEL: Record<string, string> = {
  estandar:              'Estándar',
  a_medida_proveedor:    'A medida',
  fabricacion_propia:    'Fabricación',
};

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ presupuestos_activos: 0, ventas_mes: 0, monto_mes: 0, clientes_total: 0 });
  const [recientes, setRecientes] = useState<Operacion[]>([]);
  const [pendientes, setPendientes] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [
      { count: presupuestos_activos },
      { data: ventasMes },
      { count: clientes_total },
      { data: ultimasOps },
      { data: opsPendientes },
    ] = await Promise.all([
      supabase.from('operaciones').select('*', { count: 'exact', head: true })
        .in('estado', ['presupuesto', 'enviado', 'aprobado']),
      supabase.from('operaciones').select('precio_total')
        .in('estado', ['aprobado', 'en_produccion', 'listo', 'instalado', 'entregado'])
        .gte('created_at', primerDiaMes),
      supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
      supabase.from('operaciones').select('*, cliente:clientes(nombre, apellido)')
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('operaciones').select('*, cliente:clientes(nombre, apellido)')
        .in('estado', ['presupuesto', 'enviado'])
        .order('created_at', { ascending: true }).limit(5),
    ]);

    const monto_mes = (ventasMes ?? []).reduce((s, o) => s + (o.precio_total ?? 0), 0);

    setStats({
      presupuestos_activos: presupuestos_activos ?? 0,
      ventas_mes: (ventasMes ?? []).length,
      monto_mes,
      clientes_total: clientes_total ?? 0,
    });
    setRecientes((ultimasOps ?? []) as unknown as Operacion[]);
    setPendientes((opsPendientes ?? []) as unknown as Operacion[]);
    setLoading(false);
  }

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {saludo}, {profile?.nombre ?? 'usuario'} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Link
          to="/operaciones/nueva"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nueva operación
        </Link>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Presupuestos activos"
            value={stats.presupuestos_activos}
            icon={<ClipboardList size={18} className="text-blue-500" />}
            bg="bg-blue-50"
          />
          <StatCard
            label="Ventas este mes"
            value={stats.ventas_mes}
            icon={<TrendingUp size={18} className="text-green-500" />}
            bg="bg-green-50"
          />
          <StatCard
            label="Facturado mes"
            value={formatCurrency(stats.monto_mes)}
            icon={<TrendingUp size={18} className="text-emerald-500" />}
            bg="bg-emerald-50"
          />
          <StatCard
            label="Clientes"
            value={stats.clientes_total}
            icon={<Users size={18} className="text-purple-500" />}
            bg="bg-purple-50"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Presupuestos pendientes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-800">Pendientes de seguimiento</h2>
              {pendientes.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {pendientes.length}
                </span>
              )}
            </div>
            <Link to="/operaciones?estado=presupuesto" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pendientes.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">Sin presupuestos pendientes</p>
              </div>
            ) : pendientes.map(op => (
              <Link key={op.id} to={`/operaciones/${op.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {(op.cliente as any)?.nombre} {(op.cliente as any)?.apellido ?? ''}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[op.estado]}`}>
                      {ESTADO_LABEL[op.estado]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {op.numero} · {TIPO_LABEL[op.tipo]} · {formatDate(op.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{formatCurrency(op.precio_total)}</p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Últimas operaciones */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-gray-800">Últimas operaciones</h2>
            </div>
            <Link to="/operaciones" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recientes.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <AlertCircle size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No hay operaciones aún</p>
                <Link to="/operaciones/nueva" className="text-xs text-brand-600 hover:underline mt-1 block">
                  Crear la primera
                </Link>
              </div>
            ) : recientes.map(op => (
              <Link key={op.id} to={`/operaciones/${op.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {(op.cliente as any)?.nombre} {(op.cliente as any)?.apellido ?? ''}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[op.estado]}`}>
                      {ESTADO_LABEL[op.estado]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {op.numero} · {TIPO_LABEL[op.tipo]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{formatCurrency(op.precio_total)}</p>
                  <p className="text-xs text-gray-400">{formatDate(op.created_at)}</p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, bg }: { label: string; value: string | number; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}
