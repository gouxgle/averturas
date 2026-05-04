import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Plus, ArrowRight, CheckCircle2, AlertTriangle,
  Sparkles, Clock, Receipt, Package, CalendarClock, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

interface OpItem {
  id: string; numero: string; precio_total: number; estado: string; created_at: string;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
  cobrado?: number;
}

interface Compromiso {
  id: string; monto: number; fecha_vencimiento: string; tipo: string; descripcion: string | null;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
  operacion: { id: string; numero: string } | null;
}

interface StockBajo {
  id: string; nombre: string; stock_minimo: number; stock_actual: number;
}

interface Indicadores {
  sin_confirmar:         OpItem[];
  sin_pago:              OpItem[];
  pagados_no_entregados: OpItem[];
  compromisos_semana:    Compromiso[];
  stock_bajo:            StockBajo[];
}

function nombreCliente(c: OpItem['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

// ── Card de indicador ─────────────────────────────────────────────
function IndicadorCard({
  title, count, icon: Icon, color, accentBg, children, href,
}: {
  title: string; count: number; icon: React.ElementType;
  color: string; accentBg: string; children: React.ReactNode; href?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-50 ${accentBg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/80 shadow-sm`}>
            <Icon size={15} className={color} />
          </div>
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-extrabold tabular-nums ${color}`}>{count}</span>
          {href && (
            <Link to={href} className="p-1 hover:bg-white/60 rounded-lg transition-colors">
              <ChevronRight size={14} className="text-gray-400" />
            </Link>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function OpRow({ op, suffix }: { op: OpItem; suffix?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/presupuestos?id=${op.id}`)}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{nombreCliente(op.cliente)}</p>
        <p className="text-xs text-gray-400 font-mono mt-0.5">{op.numero}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(Number(op.precio_total))}</p>
        {suffix}
      </div>
    </button>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
      <p className="text-xs text-gray-400">{msg}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="h-14 bg-gray-50 border-b border-gray-100" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="px-5 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-2/3" />
            <div className="h-2.5 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-4 bg-gray-100 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────
export function Dashboard() {
  const { user } = useAuth();
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Indicadores>('/dashboard/indicadores')
      .then(d => { setInd(d); setLoading(false); });
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
        <svg className="absolute right-0 top-0 opacity-[0.07]" width="220" height="160" viewBox="0 0 220 160" fill="none">
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
            style={{ background: '#e31e24', color: '#fff', boxShadow: '0 4px 14px rgba(227,30,36,0.35)' }}
          >
            <Plus size={15} /> Nuevo presupuesto
          </Link>
        </div>
      </div>

      {/* ── Accesos rápidos ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/presupuestos/nuevo', label: 'Nuevo presupuesto', icon: FileText,    iconCls: 'text-violet-600',  bg: 'bg-violet-50 border-violet-100',  hov: 'hover:bg-violet-100 hover:border-violet-200' },
          { to: '/recibos/nuevo',      label: 'Nuevo recibo',      icon: Receipt,     iconCls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', hov: 'hover:bg-emerald-100 hover:border-emerald-200' },
          { to: '/remitos',            label: 'Remitos',           icon: Package,     iconCls: 'text-sky-600',     bg: 'bg-sky-50 border-sky-100',        hov: 'hover:bg-sky-100 hover:border-sky-200' },
          { to: '/presupuestos',       label: 'Presupuestos',      icon: ArrowRight,  iconCls: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100',    hov: 'hover:bg-amber-100 hover:border-amber-200' },
        ].map(({ to, label, icon: Icon, iconCls, bg, hov }, i) => (
          <Link
            key={to} to={to}
            className={`fade-in d${i + 1} flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all text-center card-lift ${bg} ${hov}`}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white shadow-sm">
              <Icon size={17} className={iconCls} />
            </div>
            <span className={`text-xs font-semibold ${iconCls}`}>{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Indicadores de presupuestos ───────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : ind && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* a) Sin confirmar */}
            <IndicadorCard
              title="Sin confirmar"
              count={ind.sin_confirmar.length}
              icon={Clock}
              color="text-amber-600"
              accentBg="bg-amber-50/60"
              href="/presupuestos"
            >
              {ind.sin_confirmar.length === 0
                ? <EmptyRow msg="Sin presupuestos pendientes" />
                : ind.sin_confirmar.map(op => (
                  <OpRow key={op.id} op={op} suffix={
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                      {op.estado === 'enviado' ? 'Enviado' : 'Borrador'}
                    </p>
                  } />
                ))
              }
            </IndicadorCard>

            {/* b) Aprobados sin pago */}
            <IndicadorCard
              title="Aprobados sin pago"
              count={ind.sin_pago.length}
              icon={Receipt}
              color="text-red-600"
              accentBg="bg-red-50/60"
              href="/presupuestos"
            >
              {ind.sin_pago.length === 0
                ? <EmptyRow msg="Todos los aprobados tienen pago" />
                : ind.sin_pago.map(op => (
                  <OpRow key={op.id} op={op} suffix={
                    <p className="text-[10px] text-red-500 font-medium mt-0.5">Sin cobro</p>
                  } />
                ))
              }
            </IndicadorCard>

            {/* c) Pagados no entregados */}
            <IndicadorCard
              title="Pagados sin entregar"
              count={ind.pagados_no_entregados.length}
              icon={Package}
              color="text-sky-600"
              accentBg="bg-sky-50/60"
              href="/remitos"
            >
              {ind.pagados_no_entregados.length === 0
                ? <EmptyRow msg="Todos los pagados fueron entregados" />
                : ind.pagados_no_entregados.map(op => (
                  <OpRow key={op.id} op={op} suffix={
                    <p className="text-[10px] text-sky-500 font-medium mt-0.5">Pago total</p>
                  } />
                ))
              }
            </IndicadorCard>
          </div>

          {/* ── Compromisos + Stock bajo ────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* d) Compromisos por vencer */}
            <IndicadorCard
              title="Compromisos que vencen esta semana"
              count={ind.compromisos_semana.length}
              icon={CalendarClock}
              color="text-orange-600"
              accentBg="bg-orange-50/60"
            >
              {ind.compromisos_semana.length === 0
                ? <EmptyRow msg="Sin compromisos en los próximos 7 días" />
                : ind.compromisos_semana.map(cp => (
                  <div key={cp.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{nombreCliente(cp.cliente)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {cp.operacion && (
                          <span className="text-[10px] font-mono text-sky-600">{cp.operacion.numero}</span>
                        )}
                        {cp.descripcion && (
                          <span className="text-[10px] text-gray-400 truncate">{cp.descripcion}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-orange-600 tabular-nums">{formatCurrency(Number(cp.monto))}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtFecha(cp.fecha_vencimiento)}</p>
                    </div>
                  </div>
                ))
              }
            </IndicadorCard>

            {/* e) Stock bajo */}
            <IndicadorCard
              title="Productos con stock bajo"
              count={ind.stock_bajo.length}
              icon={AlertTriangle}
              color="text-rose-600"
              accentBg="bg-rose-50/60"
              href="/stock"
            >
              {ind.stock_bajo.length === 0
                ? <EmptyRow msg="Todos los productos tienen stock suficiente" />
                : ind.stock_bajo.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Mínimo: {p.stock_minimo} u.</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-extrabold tabular-nums ${Number(p.stock_actual) <= 0 ? 'text-red-600' : 'text-rose-500'}`}>
                        {Number(p.stock_actual)} u.
                      </span>
                      {Number(p.stock_actual) <= 0 && (
                        <p className="text-[10px] text-red-500 font-semibold mt-0.5">Sin stock</p>
                      )}
                    </div>
                  </div>
                ))
              }
            </IndicadorCard>

          </div>
        </>
      )}
    </div>
  );
}
