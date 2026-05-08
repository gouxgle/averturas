import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone, Truck, MessageCircle, CalendarClock,
  DollarSign, FileText, Target, TrendingUp,
  AlertTriangle, CheckCircle2, Sparkles,
  Clock, Package, ChevronRight, Plus,
  BarChart3, ShoppingBag, Activity, Lightbulb,
  Users, Mail,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

// ── Tipos ────────────────────────────────────────────────────────────

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
  primer_item?: string | null;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
}

interface Compromiso {
  id: string; monto: number; fecha_vencimiento: string; tipo: string; descripcion: string | null;
  cliente: { nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
  operacion: { id: string; numero: string } | null;
}

interface StockBajo { id: string; nombre: string; stock_minimo: number; stock_actual: number }

interface TopProducto { descripcion: string; veces_vendido: number; unidades: number; monto_total: number }

interface ContactoCliente {
  id: string; nombre: string | null; apellido: string | null; razon_social: string | null;
  tipo_persona: string; telefono: string | null; estado: string;
  preferencia_contacto: string | null; ultima_interaccion: string | null;
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

// ── Helpers ──────────────────────────────────────────────────────────

function nombreCliente(c: OpItem['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Borrador', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

const ESTADO_DOT: Record<string, string> = {
  presupuesto: 'bg-gray-400', enviado: 'bg-amber-400', aprobado: 'bg-emerald-500',
  en_produccion: 'bg-blue-500', listo: 'bg-teal-500', instalado: 'bg-violet-500',
  entregado: 'bg-green-500', cancelado: 'bg-red-400',
};

// ── Dashboard ────────────────────────────────────────────────────────

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

  const now = new Date();
  const hora = now.getHours();
  const saludo = hora < 12 ? '¡Buenos días' : hora < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  const fechaHoy = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100);

  const enviados = data ? data.sin_confirmar.filter(o => o.estado === 'enviado') : [];
  const convPct = data && (data.stats.ventas_mes + data.stats.presupuestos_activos) > 0
    ? Math.round((data.stats.ventas_mes / (data.stats.ventas_mes + data.stats.presupuestos_activos)) * 100)
    : 0;

  return (
    <div className="page-enter p-6 max-w-[1340px] mx-auto">

      {/* ── Encabezado ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {saludo}, {user?.nombre ?? 'usuario'}! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {fechaHoy} · Acá tenés todo lo importante de tu negocio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 shadow-sm">
            <CalendarClock size={14} className="text-gray-400" />
            Hoy, {now.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
          </div>
          <Link
            to="/presupuestos/nuevo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0d3a8a 0%, #e31e24 100%)' }}
          >
            <Plus size={15} /> Nuevo presupuesto
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            {[90, 120, 200, 180].map((h, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl" style={{ height: h }} />
            ))}
          </div>
          <div className="w-72 space-y-4">
            {[160, 140, 200].map((h, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl" style={{ height: h }} />
            ))}
          </div>
        </div>
      ) : data && (
        <div className="flex gap-5 items-start">

          {/* ── Columna principal ─────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* PRIORIDADES DE HOY */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target size={15} className="text-red-500" />
                <h2 className="text-sm font-bold text-gray-800">PRIORIDADES DE HOY</h2>
                <span className="text-xs text-gray-400 ml-1">Tu foco para hoy</span>
                <Link to="/presupuestos" className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Ver agenda completa <ChevronRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  {
                    icon: Phone, color: 'text-blue-600', bg: 'bg-blue-100',
                    title: `Llamar a ${enviados.length} cliente${enviados.length !== 1 ? 's' : ''}`,
                    sub: 'Presupuestos sin respuesta',
                    count: enviados.length, href: '/presupuestos',
                  },
                  {
                    icon: Truck, color: 'text-amber-600', bg: 'bg-amber-100',
                    title: `${data.pagados_no_entregados.length} pedido${data.pagados_no_entregados.length !== 1 ? 's' : ''} listo${data.pagados_no_entregados.length !== 1 ? 's' : ''} para entregar`,
                    sub: 'Coordiná la entrega hoy',
                    count: data.pagados_no_entregados.length, href: '/remitos',
                  },
                  {
                    icon: MessageCircle, color: 'text-teal-600', bg: 'bg-teal-100',
                    title: `${data.sin_pago.length} cliente${data.sin_pago.length !== 1 ? 's' : ''} esperando confirmación`,
                    sub: 'Respondé para avanzar',
                    count: data.sin_pago.length, href: '/presupuestos',
                  },
                  {
                    icon: CalendarClock, color: 'text-violet-600', bg: 'bg-violet-100',
                    title: `${data.compromisos_semana.length} presupuesto${data.compromisos_semana.length !== 1 ? 's' : ''} para dar seguimiento`,
                    sub: 'Vencen esta semana',
                    count: data.compromisos_semana.length, href: '/presupuestos',
                  },
                ].map(({ icon: Icon, color, bg, title, sub, count, href }) => (
                  <Link
                    key={href + title}
                    to={href}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon size={17} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-gray-800 leading-snug">{title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{sub}</p>
                    </div>
                    {count > 0 && (
                      <span className="text-[11px] font-extrabold bg-red-500 text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0 mt-0.5">
                        {count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {/* NÚMEROS CLAVE */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={15} className="text-blue-600" />
                <h2 className="text-sm font-bold text-gray-800">NÚMEROS CLAVE DEL NEGOCIO</h2>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {/* Ventas del día */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-gray-500">Ventas del día</p>
                  <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-none">
                    {formatCurrency(data.stats.ventas_hoy)}
                  </p>
                  <p className="text-[11px] text-gray-400">Promedio: {formatCurrency(dayOfMonth > 0 ? data.stats.monto_mes / dayOfMonth : 0)}/día</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(data.stats.monto_mes > 0 ? Math.round((data.stats.ventas_hoy / (data.stats.monto_mes / dayOfMonth)) * 100) : 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 w-7 text-right tabular-nums">
                      {data.stats.monto_mes > 0 ? Math.min(Math.round((data.stats.ventas_hoy / (data.stats.monto_mes / dayOfMonth)) * 100), 999) : 0}%
                    </span>
                  </div>
                </div>

                {/* Ventas del mes */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-gray-500">Ventas del mes</p>
                  <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-none">
                    {formatCurrency(data.stats.monto_mes)}
                  </p>
                  <p className="text-[11px] text-gray-400">Día {dayOfMonth} de {daysInMonth} — {data.stats.ventas_mes} ops.</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${monthPct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 w-7 text-right tabular-nums">{monthPct}%</span>
                  </div>
                </div>

                {/* Presupuestos enviados */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-gray-500">Presupuestos enviados</p>
                  <div className="flex items-end gap-2">
                    <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-none">{data.sin_confirmar.length}</p>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-0.5">
                      <FileText size={15} className="text-blue-500" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">Activos este mes</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(data.sin_confirmar.length * 10, 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-blue-500 w-7 text-right tabular-nums">{data.sin_confirmar.length}</span>
                  </div>
                </div>

                {/* % Cierre */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-gray-500">% de cierre de ventas</p>
                  <div className="flex items-end gap-2">
                    <p className="text-xl font-extrabold text-gray-900 tabular-nums leading-none">{convPct}%</p>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-0.5">
                      <TrendingUp size={15} className="text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">{data.stats.ventas_mes} cerrados de {data.stats.ventas_mes + data.stats.presupuestos_activos}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${convPct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 w-7 text-right tabular-nums">{convPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VENTAS EN RIESGO + SEGUIMIENTO AUTOMÁTICO */}
            <div className="grid grid-cols-5 gap-4">

              {/* Ventas en riesgo */}
              <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <h2 className="text-sm font-bold text-gray-800 flex-1">VENTAS EN RIESGO</h2>
                  <Link to="/presupuestos" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    Ver todos <ChevronRight size={12} />
                  </Link>
                </div>

                {enviados.length === 0 ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-xs text-gray-400">Sin presupuestos enviados en espera</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold text-red-500 mb-2">Presupuestos enviados sin respuesta</p>
                    <div className="space-y-px">
                      {enviados.map(op => {
                        const dias = diasDesde(op.created_at);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => navigate(`/presupuestos?id=${op.id}`)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-gray-800 truncate">{nombreCliente(op.cliente)}</p>
                              {op.primer_item && (
                                <p className="text-[11px] text-gray-400 truncate mt-0.5">{op.primer_item}</p>
                              )}
                            </div>
                            <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{formatCurrency(Number(op.precio_total))}</p>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              dias > 7 ? 'bg-red-100 text-red-700' : dias > 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              Hace {dias} día{dias !== 1 ? 's' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <Link
                      to="/presupuestos"
                      className="flex items-center justify-center mt-3 py-2 text-[12px] font-semibold text-red-600 hover:text-red-700 border border-red-100 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      Ver todos los presupuestos en riesgo
                    </Link>
                  </>
                )}
              </div>

              {/* Seguimiento automático */}
              <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle size={14} className="text-violet-500" />
                  <h2 className="text-sm font-bold text-gray-800 flex-1">SEGUIMIENTO AUTOMÁTICO</h2>
                  <Link to="/clientes" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    Ver todos <ChevronRight size={12} />
                  </Link>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">A quién contactar hoy</p>

                {data.sin_contacto.length === 0 ? (
                  <div className="py-6 text-center">
                    <CheckCircle2 size={18} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-xs text-gray-400">Todos los clientes con contacto reciente</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {data.sin_contacto.slice(0, 4).map(cl => {
                        const nombre = cl.tipo_persona === 'juridica'
                          ? (cl.razon_social ?? '—')
                          : [cl.apellido, cl.nombre].filter(Boolean).join(', ') || '—';
                        const pref = cl.preferencia_contacto;
                        const ChannelIcon = pref === 'email' ? Mail : MessageCircle;
                        const waLink = cl.telefono
                          ? `https://wa.me/${cl.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${cl.nombre ?? ''}, te contactamos desde César Brítez Aberturas.`)}`
                          : null;
                        const dias = cl.dias_sin_contacto;
                        return (
                          <div key={cl.id} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              pref === 'email' ? 'bg-blue-100' : 'bg-green-100'
                            }`}>
                              <ChannelIcon size={13} className={pref === 'email' ? 'text-blue-600' : 'text-green-600'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold text-gray-800 truncate leading-tight">{nombre}</p>
                              <p className="text-[10px] text-gray-400">Hace {dias} día{dias !== 1 ? 's' : ''}</p>
                            </div>
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors shrink-0"
                              >
                                Contactar
                              </a>
                            ) : (
                              <Link
                                to={`/clientes/${cl.id}`}
                                className="px-2.5 py-1 text-[11px] font-bold text-violet-700 bg-violet-100 hover:bg-violet-200 rounded-lg transition-colors shrink-0"
                              >
                                Ver
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Link
                      to="/clientes"
                      className="flex items-center justify-center mt-3 py-2 text-[12px] font-semibold text-violet-600 hover:text-violet-700 border border-violet-100 rounded-xl hover:bg-violet-50 transition-colors"
                    >
                      Ver todos los seguimientos
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* PRODUCTOS MÁS VENDIDOS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={15} className="text-amber-500" />
                <h2 className="text-sm font-bold text-gray-800 flex-1">PRODUCTOS MÁS VENDIDOS</h2>
                <span className="text-xs text-gray-400">Este mes</span>
                <Link to="/productos" className="ml-3 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Ver reporte completo <ChevronRight size={12} />
                </Link>
              </div>

              {data.top_productos.length === 0 ? (
                <div className="py-6 text-center">
                  <Package size={18} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">Sin datos de ventas por producto aún</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {data.top_productos.map((p, i) => {
                    const palettes = [
                      { num: 'bg-blue-600', bar: 'bg-blue-100 border-blue-200', price: 'text-blue-700' },
                      { num: 'bg-teal-600', bar: 'bg-teal-50 border-teal-200', price: 'text-teal-700' },
                      { num: 'bg-violet-600', bar: 'bg-violet-50 border-violet-200', price: 'text-violet-700' },
                      { num: 'bg-amber-500', bar: 'bg-amber-50 border-amber-200', price: 'text-amber-700' },
                    ];
                    const pal = palettes[i] ?? palettes[0];
                    return (
                      <div key={p.descripcion} className={`rounded-xl border p-3 flex flex-col gap-2 ${pal.bar}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${pal.num}`}>
                            <span className="text-sm font-black text-white">{i + 1}</span>
                          </div>
                          <div className="w-full min-w-0">
                            <div className="h-12 rounded-lg bg-white/60 flex items-center justify-center">
                              <Package size={22} className="text-gray-300" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-gray-800 leading-snug line-clamp-2">{p.descripcion}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{p.unidades} unidades</p>
                          <p className={`text-sm font-extrabold mt-1 tabular-nums ${pal.price}`}>
                            {formatCurrency(Number(p.monto_total))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {/* Relleno si hay menos de 4 */}
                  {Array.from({ length: Math.max(0, 4 - data.top_productos.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="rounded-xl border border-dashed border-gray-200 p-3 flex items-center justify-center">
                      <p className="text-[11px] text-gray-300 text-center">Sin datos</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────────────────────── */}
          <div className="w-[300px] shrink-0 space-y-4">

            {/* SUGERENCIAS DEL SISTEMA */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={14} className="text-amber-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Sugerencias del sistema</h2>
              </div>

              <div className="space-y-1">
                {[
                  data.stats.sin_contacto_30 > 0 && {
                    icon: Users, color: 'text-blue-500', bg: 'bg-blue-50',
                    text: `Hoy podés hacer seguimiento a ${data.stats.sin_contacto_30} cliente${data.stats.sin_contacto_30 > 1 ? 's' : ''} clave que mostraron interés.`,
                  },
                  enviados.length > 0 && {
                    icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50',
                    text: `Tenés ${formatCurrency(enviados.reduce((s, o) => s + Number(o.precio_total), 0))} en presupuestos sin cerrar.`,
                  },
                  data.top_productos.length > 0 && {
                    icon: ShoppingBag, color: 'text-amber-500', bg: 'bg-amber-50',
                    text: `Los productos de "${data.top_productos[0]?.descripcion?.split(' ').slice(0, 3).join(' ')}" se están vendiendo más esta semana.`,
                  },
                  data.stats.tareas_vencidas > 0 && {
                    icon: Clock, color: 'text-red-500', bg: 'bg-red-50',
                    text: `Tenés ${data.stats.tareas_vencidas} tarea${data.stats.tareas_vencidas > 1 ? 's' : ''} vencida${data.stats.tareas_vencidas > 1 ? 's' : ''} pendiente${data.stats.tareas_vencidas > 1 ? 's' : ''}.`,
                  },
                ].filter(Boolean).slice(0, 3).map((s, i) => {
                  if (!s) return null;
                  const Ico = (s as { icon: React.ElementType; color: string; bg: string; text: string }).icon;
                  const { color, bg, text } = s as { icon: React.ElementType; color: string; bg: string; text: string };
                  return (
                    <button
                      key={i}
                      type="button"
                      className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                        <Ico size={13} className={color} />
                      </div>
                      <p className="flex-1 text-[12px] text-gray-600 leading-snug">{text}</p>
                      <ChevronRight size={14} className="text-gray-300 shrink-0 mt-1" />
                    </button>
                  );
                })}

                {[data.stats.sin_contacto_30, enviados.length, data.top_productos.length, data.stats.tareas_vencidas].every(v => v === 0) && (
                  <div className="py-4 text-center">
                    <CheckCircle2 size={18} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-xs text-gray-400">¡Todo bajo control!</p>
                  </div>
                )}
              </div>

              <Link
                to="/presupuestos"
                className="flex items-center justify-center mt-3 py-2 text-[12px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors"
              >
                Ver oportunidades de venta
              </Link>
            </div>

            {/* PROBLEMAS OPERATIVOS */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex-1">Problemas operativos</h2>
                <Link to="/presupuestos" className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                  Ver todos <ChevronRight size={11} />
                </Link>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Package, iconBg: 'bg-red-100', iconCl: 'text-red-600', label: 'Stock crítico', sub: `${data.stock_bajo.length} producto${data.stock_bajo.length !== 1 ? 's' : ''}`, count: data.stock_bajo.length, badgeCl: 'bg-red-500', href: '/stock' },
                  { icon: Truck, iconBg: 'bg-amber-100', iconCl: 'text-amber-600', label: 'Pedidos demorados', sub: `${data.pagados_no_entregados.length} pedido${data.pagados_no_entregados.length !== 1 ? 's' : ''}`, count: data.pagados_no_entregados.length, badgeCl: 'bg-amber-500', href: '/remitos' },
                  { icon: Clock, iconBg: 'bg-orange-100', iconCl: 'text-orange-600', label: 'Entregas pendientes', sub: `${data.sin_pago.length} entrega${data.sin_pago.length !== 1 ? 's' : ''}`, count: data.sin_pago.length, badgeCl: 'bg-orange-500', href: '/presupuestos' },
                ].map(({ icon: Icon, iconBg, iconCl, label, sub, count, badgeCl, href }) => (
                  <Link
                    key={label}
                    to={href}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                      <Icon size={16} className={iconCl} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800">{label}</p>
                      <p className="text-[11px] text-gray-400">{sub}</p>
                    </div>
                    <span className={`text-[11px] font-extrabold text-white px-2 py-0.5 rounded-full min-w-[24px] text-center ${count > 0 ? badgeCl : 'bg-emerald-400'}`}>
                      {count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* ACTIVIDAD RECIENTE */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={14} className="text-blue-500" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Actividad reciente</h2>
              </div>
              <div className="space-y-1">
                {data.recientes.map(op => {
                  const horasAtras = Math.floor((Date.now() - new Date(op.created_at).getTime()) / 3_600_000);
                  const tiempoLabel = horasAtras < 1 ? 'Hace menos de 1 h' : horasAtras < 24 ? `Hace ${horasAtras} h` : `Hace ${Math.floor(horasAtras / 24)} días`;
                  const dotCl = ESTADO_DOT[op.estado] ?? 'bg-gray-400';
                  const iconMap: Record<string, React.ElementType> = {
                    presupuesto: FileText, enviado: FileText, aprobado: CheckCircle2,
                    en_produccion: Package, listo: Package, instalado: Truck,
                    entregado: Truck, cancelado: AlertTriangle,
                  };
                  const Icon = iconMap[op.estado] ?? FileText;
                  const iconBgMap: Record<string, string> = {
                    presupuesto: 'bg-gray-100 text-gray-600', enviado: 'bg-amber-100 text-amber-600',
                    aprobado: 'bg-emerald-100 text-emerald-600', en_produccion: 'bg-blue-100 text-blue-600',
                    listo: 'bg-teal-100 text-teal-600', instalado: 'bg-violet-100 text-violet-600',
                    entregado: 'bg-green-100 text-green-600', cancelado: 'bg-red-100 text-red-600',
                  };
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => navigate(`/presupuestos?id=${op.id}`)}
                      className="w-full flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBgMap[op.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-800 truncate">
                          {ESTADO_LABEL[op.estado] ?? op.estado === 'presupuesto' ? 'Nuevo presupuesto creado' : `${ESTADO_LABEL[op.estado]}`}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">{nombreCliente(op.cliente)} · {formatCurrency(Number(op.precio_total))}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{tiempoLabel}</p>
                    </button>
                  );
                })}
              </div>
              <Link
                to="/presupuestos"
                className="flex items-center justify-center mt-3 py-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
              >
                Ver toda la actividad
              </Link>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
