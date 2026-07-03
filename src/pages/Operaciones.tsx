import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, CheckCircle2, XCircle, Truck, Package,
  CalendarClock, BarChart3, Zap, ChevronRight,
  ShoppingCart, FileText, ClipboardCheck, MessageCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';

// ── Tipos ────────────────────────────────────────────────────────────

interface TOp {
  id: string; numero: string; estado: string; tipo: string;
  precio_total: number; cobrado_total: number;
  created_at: string; fecha_entrega_estimada: string | null;
  updated_at: string; dias_en_estado: number;
  primer_item: string | null;
  pedido_fecha_entrega_est: string | null;
  cliente: { id: string; nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string; telefono: string | null };
}

interface TProxima {
  id: string; numero: string; precio_total: number; estado: string;
  fecha_entrega_estimada: string;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

interface TStats {
  total_activas: number; valor_activas: number;
  sin_confirmar: number; entregadas_semana: number; valor_entregadas_semana: number;
}

interface TableroData {
  stats: TStats;
  kanban: {
    sin_confirmar: TOp[]; confirmadas: TOp[]; con_pedido: TOp[];
    listas_entregar: TOp[]; entregadas: TOp[]; canceladas: TOp[];
  };
  proximas: TProxima[];
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

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtLlegada(iso: string | null): string | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fecha = new Date(iso.slice(0, 10) + 'T12:00:00');
  const diff = Math.round((fecha.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return 'llega hoy';
  if (diff === 1) return 'llega mañana';
  return `llega el ${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`;
}

// ── Sub-componentes ──────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, iconBg, iconCl, subCl = 'text-gray-400' }: {
  icon: React.ElementType; label: string; value: string | number; sub: string;
  iconBg: string; iconCl: string; subCl?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-300 shadow-lg p-4">
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

function PagoBadge({ cobrado, total }: { cobrado: number; total: number }) {
  if (cobrado >= total * 0.99)
    return <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">Pago total</span>;
  if (cobrado > 0)
    return <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Señado</span>;
  return <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">Sin pago</span>;
}

type ColKey = 'sin_confirmar' | 'confirmadas' | 'con_pedido' | 'listas_entregar' | 'entregadas' | 'canceladas';

const ESTADO_BADGE: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-600',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-emerald-100 text-emerald-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  entregado:     'bg-blue-200 text-blue-800',
  cancelado:     'bg-red-100 text-red-600',
  rechazado:     'bg-red-100 text-red-600',
};

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Pendiente de Aprobación', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo',
  entregado: 'Entregado', cancelado: 'Cancelado', rechazado: 'Rechazado',
};

function TCard({ op, col }: { op: TOp; col: ColKey }) {
  const navigate = useNavigate();
  const showPago = col === 'sin_confirmar' || col === 'confirmadas';
  const [avisando, setAvisando] = useState(false);
  const [avisado,  setAvisado]  = useState(false);

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all"
      onClick={() => navigate(`/operaciones/${op.id}`)}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] font-mono font-bold text-blue-600">{op.numero}</span>
        <span className={cn('text-[9px] font-semibold px-1 py-0.5 rounded-full truncate max-w-[90px]', ESTADO_BADGE[op.estado] ?? 'bg-gray-100 text-gray-600')}>
          {ESTADO_LABEL[op.estado] ?? op.estado}
        </span>
      </div>

      <p className="text-[11px] font-semibold text-gray-800 truncate">{ncl(op.cliente)}</p>

      {op.primer_item && (
        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{op.primer_item}</p>
      )}

      {op.fecha_entrega_estimada && (
        <p className="text-[10px] text-gray-400 mt-0.5">{fmtFecha(op.fecha_entrega_estimada)}</p>
      )}

      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-200">
        <p className="text-[12px] font-extrabold text-gray-900 tabular-nums">{formatCurrency(op.precio_total)}</p>
        {showPago && <PagoBadge cobrado={op.cobrado_total} total={op.precio_total} />}
        {col === 'canceladas' && <XCircle size={14} className="text-red-400 shrink-0" />}
        {col === 'entregadas' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
      </div>

      {col === 'con_pedido' && (() => {
        const llegada = fmtLlegada(op.pedido_fecha_entrega_est);
        if (!llegada) return null;
        const urgente = llegada === 'llega hoy' || llegada === 'llega mañana';
        return (
          <p className={cn('text-[10px] font-semibold mt-1.5', urgente ? 'text-amber-600' : 'text-gray-400')}>
            {llegada}
          </p>
        );
      })()}

      {col === 'confirmadas' && (
        <Link
          to={`/pedidos/nuevo?operacion_id=${op.id}`}
          onClick={e => e.stopPropagation()}
          className="mt-2 flex items-center justify-center gap-1 w-full text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg py-1 transition-colors"
        >
          <ShoppingCart size={10} />Crear pedido →
        </Link>
      )}
      {col === 'listas_entregar' && (
        <div className="mt-2 space-y-1" onClick={e => e.stopPropagation()}>
          {op.cliente.telefono && (
            <button
              disabled={avisando || avisado}
              onClick={async () => {
                setAvisando(true);
                try {
                  await api.post(`/operaciones/${op.id}/avisar-cliente`, {});
                  setAvisado(true);
                  toast.success('Cliente avisado por WhatsApp');
                } catch (e: any) {
                  toast.error(e?.message ?? 'Error al enviar WhatsApp');
                } finally {
                  setAvisando(false);
                }
              }}
              className="flex items-center justify-center gap-1 w-full text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg py-1 transition-colors disabled:opacity-50"
            >
              <MessageCircle size={10} />
              {avisado ? '✓ Avisado' : avisando ? 'Enviando...' : 'Avisar al cliente →'}
            </button>
          )}
          <Link
            to={`/remitos/nuevo?operacion_id=${op.id}`}
            className="flex items-center justify-center gap-1 w-full text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg py-1 transition-colors"
          >
            <Truck size={10} />Crear remito →
          </Link>
        </div>
      )}
    </div>
  );
}

const COL_SHOW = 4;

function TCol({ col, title, color, ops }: {
  col: ColKey; title: string; color: string; ops: TOp[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? ops : ops.slice(0, COL_SHOW);
  const cls = {
    slate: { header: 'border-slate-400 text-slate-700 bg-slate-50',     badge: 'bg-slate-500' },
    green: { header: 'border-emerald-400 text-emerald-700 bg-emerald-50', badge: 'bg-emerald-500' },
    amber: { header: 'border-amber-400 text-amber-700 bg-amber-50',       badge: 'bg-amber-500' },
    teal:  { header: 'border-teal-400 text-teal-700 bg-teal-50',          badge: 'bg-teal-500' },
    blue:  { header: 'border-blue-400 text-blue-700 bg-blue-50',          badge: 'bg-blue-500' },
    red:   { header: 'border-red-300 text-red-600 bg-red-50',             badge: 'bg-red-400' },
  }[color] ?? { header: 'border-gray-300 text-gray-700 bg-gray-50', badge: 'bg-gray-400' };

  return (
    <div className="flex-1 min-w-[145px] max-w-[200px]">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border-l-4 mb-2 ${cls.header}`}>
        <p className="text-[12px] font-bold truncate">{title}</p>
        <span className={`text-[10px] font-extrabold text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 ${cls.badge}`}>
          {ops.length}
        </span>
      </div>
      <div className="space-y-2">
        {visible.map(op => <TCard key={op.id} op={op} col={col} />)}
      </div>
      {ops.length === 0 && (
        <p className="text-center text-[11px] text-gray-400 py-6">Sin operaciones</p>
      )}
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

// ── Componente principal ─────────────────────────────────────────────

export function Operaciones() {
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api.get<TableroData>('/operaciones/tablero');
      setData(d);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const todayStr    = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  const proximasHoy    = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0, 10) === todayStr)    ?? [];
  const proximasMañana = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0, 10) === tomorrowStr) ?? [];
  const proximasSemana = data?.proximas.filter(p => p.fecha_entrega_estimada.slice(0, 10) > tomorrowStr)   ?? [];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-[1440px] mx-auto space-y-4" data-section="operaciones">

      <SectionHero
        section="operaciones"
        icon={ClipboardCheck}
        title="Tablero de Operaciones"
        sub="Estado del flujo de trabajo — del presupuesto a la entrega"
        actions={
          <Link to="/operaciones/nueva"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all hover:opacity-90"
            style={{ background: '#f97316' }}>
            <Plus size={16} /> Nueva operación
          </Link>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="animate-pulse rounded-2xl h-14" style={{ background: 'rgba(3,29,73,0.12)' }} />
          <div className="animate-pulse bg-gray-100 rounded-2xl h-96" />
        </div>
      ) : data && (
        <div className="flex flex-col xl:flex-row gap-5 items-start">

          {/* ── Columna principal ─────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            <CompactStatsBar items={[
              { value: data.stats.total_activas, label: `activas · ${formatCurrency(data.stats.valor_activas)}`, color: '#fbbf24' },
              { value: data.stats.sin_confirmar,  label: 'sin confirmar', color: '#94a3b8' },
              { value: data.kanban.listas_entregar.length, label: 'listas p/ entregar', color: '#2dd4bf' },
              { value: data.stats.entregadas_semana, label: 'entregadas esta semana', color: '#60a5fa' },
            ]} />

            {/* Tablero 6 columnas */}
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} className="text-amber-500" />
                <h2 className="text-sm font-bold text-gray-800">Tablero de Operaciones</h2>
                <span className="text-[11px] text-gray-400">— flujo completo</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 w-full">
                <TCol col="sin_confirmar"   title="Sin confirmar"       color="slate" ops={data.kanban.sin_confirmar} />
                <TCol col="confirmadas"     title="Confirmadas"         color="green" ops={data.kanban.confirmadas} />
                <TCol col="con_pedido"      title="Pedido proveedor"    color="amber" ops={data.kanban.con_pedido} />
                <TCol col="listas_entregar" title="Listas p/ entregar"  color="teal"  ops={data.kanban.listas_entregar} />
                <TCol col="entregadas"      title="Entregadas"          color="blue"  ops={data.kanban.entregadas} />
                <TCol col="canceladas"      title="Canceladas"          color="red"   ops={data.kanban.canceladas} />
              </div>
            </div>

          </div>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <div className="w-full xl:w-[220px] xl:shrink-0 space-y-4">

            {/* Entregas programadas */}
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
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

              <Link to="/remitos"
                className="flex items-center justify-center gap-1 mt-1 py-2 text-[12px] font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-50 transition-colors">
                <CalendarClock size={13} /> Ver remitos
              </Link>
            </div>

            {/* Resumen rápido */}
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-amber-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Resumen del flujo</h2>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Sin confirmar',       count: data.kanban.sin_confirmar.length,   color: 'bg-slate-500' },
                  { label: 'Confirmadas',          count: data.kanban.confirmadas.length,     color: 'bg-emerald-500' },
                  { label: 'Pedido al proveedor', count: data.kanban.con_pedido.length,      color: 'bg-amber-500' },
                  { label: 'Listas p/ entregar',  count: data.kanban.listas_entregar.length, color: 'bg-teal-500' },
                  { label: 'Entregadas',           count: data.kanban.entregadas.length,     color: 'bg-blue-500' },
                  { label: 'Canceladas',           count: data.kanban.canceladas.length,     color: 'bg-red-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                    <span className="text-[11px] text-gray-600 flex-1">{label}</span>
                    <span className="text-[11px] font-bold text-gray-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones rápidas */}
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-violet-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones rápidas</h2>
              </div>
              <div className="space-y-2">
                {[
                  { icon: FileText,     label: 'Ver presupuestos',  href: '/presupuestos',      color: 'text-slate-600 bg-slate-50 border-slate-200' },
                  { icon: ShoppingCart, label: 'Ver pedidos',       href: '/pedidos',            color: 'text-amber-600 bg-amber-50 border-amber-200' },
                  { icon: Truck,        label: 'Ver remitos',       href: '/remitos',            color: 'text-teal-600 bg-teal-50 border-teal-200' },
                  { icon: Package,      label: 'Nueva operación',   href: '/operaciones/nueva',  color: 'text-orange-600 bg-orange-50 border-orange-200' },
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
