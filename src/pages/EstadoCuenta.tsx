import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Printer, Receipt, Truck, TrendingUp, TrendingDown,
  DollarSign, FileText, ChevronDown, ChevronUp, Check, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// ── Colores ──────────────────────────────────────────────────
const NAVY = '#031d49';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED   = '#ef4444';
const GRAY  = '#e5e7eb';

// ── Tipos ────────────────────────────────────────────────────
interface ClienteInfo {
  id: string; nombre: string | null; apellido: string | null;
  razon_social: string | null; tipo_persona: string;
  telefono: string | null; email: string | null;
  direccion: string | null; localidad: string | null;
  documento_nro: string | null;
}

interface OpItem {
  id: string; descripcion: string; cantidad: number;
  precio_unitario: number; precio_total: number;
  incluye_instalacion: boolean; precio_instalacion: number;
  medida_ancho: number | null; medida_alto: number | null;
  color: string | null; vidrio: string | null;
  tipo_abertura: string | null; sistema: string | null;
}

interface ReciboItem {
  descripcion: string; monto: number; cantidad: number;
}

interface ReciboResumen {
  id: string; numero: string; fecha: string;
  monto_total: number; forma_pago: string;
  concepto: string | null; estado: string;
  operacion_id: string | null;
  items: ReciboItem[];
}

interface RemitoResumen {
  id: string; numero: string; fecha_emision: string;
  estado: string; operacion_id: string | null;
  medio_envio: string; fecha_entrega_real: string | null;
}

interface OperacionDetalle {
  id: string; numero: string; tipo: string; estado: string;
  precio_total: number; costo_total: number;
  created_at: string; fecha_validez: string | null;
  notas: string | null; forma_pago: string | null;
  items: OpItem[];
  recibos: ReciboResumen[];
  remitos: RemitoResumen[];
  cobrado: number; saldo: number;
}

interface EstadoCuentaData {
  cliente: ClienteInfo;
  operaciones: OperacionDetalle[];
  recibos_directos: ReciboResumen[];
  totales: { presupuestado: number; cobrado: number; saldo: number };
}

// ── Helpers ──────────────────────────────────────────────────
const FORMA_PAGO: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque',
  tarjeta_debito: 'Débito', tarjeta_credito: 'Crédito',
  mercadopago: 'MercadoPago', otro: 'Otro',
};

const ESTADO_OP_COLOR: Record<string, string> = {
  presupuesto: 'bg-gray-100 text-gray-700', enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700', rechazado: 'bg-red-100 text-red-700',
  en_produccion: 'bg-amber-100 text-amber-700', listo: 'bg-teal-100 text-teal-700',
  instalado: 'bg-purple-100 text-purple-700', entregado: 'bg-emerald-100 text-emerald-700',
};

const ESTADO_OP_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto', enviado: 'Enviado', aprobado: 'Aprobado',
  rechazado: 'Rechazado', en_produccion: 'En producción', listo: 'Listo',
  instalado: 'Instalado', entregado: 'Entregado',
};

function clienteNombre(c: ClienteInfo) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function pctCobrado(cobrado: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((cobrado / total) * 100));
}

// Agrupar recibos por mes para el gráfico
function buildMonthlyData(operaciones: OperacionDetalle[], recibosDirectos: ReciboResumen[]) {
  const map: Record<string, number> = {};
  const allRecibos = [
    ...operaciones.flatMap(op => op.recibos),
    ...recibosDirectos,
  ];
  for (const r of allRecibos) {
    const key = r.fecha.slice(0, 7); // YYYY-MM
    map[key] = (map[key] ?? 0) + Number(r.monto_total);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, monto]) => ({
      mes: new Date(mes + '-15').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      monto,
    }));
}

// ── Componente tarjeta de operación ─────────────────────────
function OperacionCard({ op }: { op: OperacionDetalle }) {
  const [open, setOpen] = useState(true);
  const pct = pctCobrado(op.cobrado, Number(op.precio_total));
  const cancelada = op.saldo <= 0.01;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <FileText size={16} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{op.numero}</span>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', ESTADO_OP_COLOR[op.estado])}>
              {ESTADO_OP_LABEL[op.estado] ?? op.estado}
            </span>
            <span className="text-xs text-gray-400">{formatDate(op.created_at)}</span>
          </div>
          {/* Barra de progreso */}
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', cancelada ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold shrink-0" style={{ color: cancelada ? GREEN : AMBER }}>
              {pct}%
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-sm font-bold text-gray-800">{formatCurrency(Number(op.precio_total))}</p>
          {!cancelada && (
            <p className="text-xs text-amber-600 font-medium">Saldo: {formatCurrency(op.saldo)}</p>
          )}
          {cancelada && (
            <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 justify-end">
              <Check size={11} /> Cancelado
            </p>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Items del presupuesto */}
          {op.items.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalle del presupuesto</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-1.5 font-semibold text-gray-500 pr-4">Ítem</th>
                      <th className="text-center py-1.5 font-semibold text-gray-500 px-2">Cant.</th>
                      <th className="text-right py-1.5 font-semibold text-gray-500 px-2">P. Unit.</th>
                      <th className="text-right py-1.5 font-semibold text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {op.items.map((item, i) => (
                      <tr key={item.id ?? i}>
                        <td className="py-2 pr-4">
                          <p className="font-medium text-gray-800">
                            {item.tipo_abertura ?? item.descripcion}
                          </p>
                          <div className="text-[10px] text-gray-400 space-y-0.5 mt-0.5">
                            {item.sistema && <span>{item.sistema}</span>}
                            {(item.medida_ancho || item.medida_alto) && (
                              <span> · {item.medida_ancho ?? '?'} × {item.medida_alto ?? '?'} m</span>
                            )}
                            {item.color && <span> · {item.color}</span>}
                            {item.vidrio && <span> · {item.vidrio}</span>}
                            {item.incluye_instalacion && (
                              <span className="text-emerald-600"> · Incl. instalación</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-center text-gray-600 px-2">{item.cantidad}</td>
                        <td className="py-2 text-right text-gray-600 px-2 font-mono">
                          {formatCurrency(Number(item.precio_unitario) + (item.incluye_instalacion ? Number(item.precio_instalacion) : 0))}
                        </td>
                        <td className="py-2 text-right font-semibold text-gray-800 font-mono">
                          {formatCurrency(Number(item.precio_total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td colSpan={3} className="py-2 text-right text-xs font-semibold text-gray-500 pr-2">Total presupuesto</td>
                      <td className="py-2 text-right font-bold text-gray-800 font-mono">{formatCurrency(Number(op.precio_total))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Recibos */}
          {op.recibos.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pagos recibidos</p>
              <div className="space-y-2">
                {op.recibos.map(r => (
                  <div key={r.id} className="flex items-start gap-3 bg-emerald-50 rounded-lg px-3 py-2.5">
                    <Receipt size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-emerald-800">{r.numero}</span>
                        <span className="text-[10px] text-gray-500">{formatDate(r.fecha)}</span>
                        <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-gray-600 border border-gray-200">
                          {FORMA_PAGO[r.forma_pago] ?? r.forma_pago}
                        </span>
                      </div>
                      {r.concepto && <p className="text-[11px] text-gray-600 mt-0.5">{r.concepto}</p>}
                      {r.items.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {r.items.map((it, i) => (
                            <p key={i} className="text-[10px] text-gray-500">
                              {it.descripcion} — {formatCurrency(Number(it.monto))}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-emerald-700 shrink-0 font-mono">
                      {formatCurrency(Number(r.monto_total))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remitos */}
          {op.remitos.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-50">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Entregas</p>
              <div className="flex flex-wrap gap-2">
                {op.remitos.map(rm => (
                  <div key={rm.id} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                    <Truck size={12} className="text-blue-500" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">{rm.numero}</p>
                      <p className="text-[10px] text-gray-500">
                        {rm.estado === 'entregado' && rm.fecha_entrega_real
                          ? `Entregado ${formatDate(rm.fecha_entrega_real)}`
                          : rm.estado}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saldo footer */}
          <div className={cn(
            'flex items-center justify-between px-5 py-3 border-t',
            cancelada ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
          )}>
            <div className="flex items-center gap-2">
              {cancelada
                ? <><Check size={14} className="text-emerald-600" /><span className="text-xs font-semibold text-emerald-700">Operación cancelada</span></>
                : <><AlertTriangle size={14} className="text-amber-600" /><span className="text-xs font-semibold text-amber-700">Saldo pendiente</span></>
              }
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Cobrado: <strong>{formatCurrency(op.cobrado)}</strong></p>
              {!cancelada && (
                <p className="text-sm font-bold text-amber-700">Saldo: {formatCurrency(op.saldo)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tooltip personalizado para el gráfico de barras ─────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-emerald-700 font-bold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export function EstadoCuenta() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<EstadoCuentaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<EstadoCuentaData>(`/clientes/${id}/estado-cuenta`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-gray-100 rounded w-1/3" />
      <div className="h-32 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  );
  if (!data) return (
    <div className="p-6 max-w-4xl mx-auto text-center py-20">
      <p className="text-gray-400">No encontrado</p>
      <Link to="/clientes" className="text-emerald-600 text-sm mt-2 hover:underline block">Volver a clientes</Link>
    </div>
  );

  const { cliente, operaciones, recibos_directos, totales } = data;
  const nombre = clienteNombre(cliente);
  const monthlyData = buildMonthlyData(operaciones, recibos_directos);
  const pctGlobal = pctCobrado(totales.cobrado, totales.presupuestado);

  const pieData = totales.presupuestado > 0 ? [
    { name: 'Cobrado', value: totales.cobrado, color: GREEN },
    { name: 'Pendiente', value: Math.max(0, totales.saldo), color: GRAY },
  ] : [];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 16mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 no-print">
          <Link to={`/clientes/${id}`} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} className="text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Estado de Cuenta</h1>
            <p className="text-sm text-gray-500">{nombre}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Printer size={14} /> Imprimir / PDF
          </button>
        </div>

        {/* Encabezado impresión (solo visible al imprimir) */}
        <div className="hidden print:block mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estado de Cuenta</p>
          <h2 className="text-lg font-bold text-gray-900">{nombre}</h2>
          {(cliente.telefono || cliente.email) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[cliente.telefono, cliente.email].filter(Boolean).join(' · ')}
            </p>
          )}
          {(cliente.direccion || cliente.localidad) && (
            <p className="text-xs text-gray-500">
              {[cliente.direccion, cliente.localidad].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">Generado: {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
        </div>

        {/* Cards resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText size={13} className="text-blue-600" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Presupuestado</span>
            </div>
            <p className="text-lg font-bold text-gray-900 font-mono">{formatCurrency(totales.presupuestado)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{operaciones.length} operación{operaciones.length !== 1 ? 'es' : ''}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <TrendingUp size={13} className="text-emerald-600" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cobrado</span>
            </div>
            <p className="text-lg font-bold text-emerald-700 font-mono">{formatCurrency(totales.cobrado)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{pctGlobal}% del total</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <TrendingDown size={13} className="text-amber-600" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Saldo</span>
            </div>
            <p className={cn('text-lg font-bold font-mono', totales.saldo > 0.01 ? 'text-amber-600' : 'text-gray-400')}>
              {formatCurrency(Math.max(0, totales.saldo))}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{totales.saldo <= 0.01 ? 'Sin deuda' : 'Pendiente de cobro'}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <DollarSign size={13} className="text-violet-600" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cobertura</span>
            </div>
            <p className={cn('text-lg font-bold font-mono', pctGlobal >= 100 ? 'text-emerald-600' : pctGlobal > 0 ? 'text-amber-600' : 'text-gray-400')}>
              {pctGlobal}%
            </p>
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', pctGlobal >= 100 ? 'bg-emerald-500' : 'bg-amber-400')}
                style={{ width: `${pctGlobal}%` }} />
            </div>
          </div>
        </div>

        {/* Gráficos */}
        {(monthlyData.length > 0 || pieData.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
            {/* Bar chart: pagos por mes */}
            {monthlyData.length > 1 && (
              <div className="sm:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cobros por mes</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="monto" fill={GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pie chart: cobrado vs pendiente */}
            {pieData.length > 0 && totales.presupuestado > 0 && (
              <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm p-4', monthlyData.length <= 1 && 'sm:col-span-3')}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cobrado vs Pendiente</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value, entry: any) => (
                        <span style={{ fontSize: 11, color: '#6b7280' }}>
                          {value}: {formatCurrency(entry.payload.value)}
                        </span>
                      )}
                    />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
                          <p className="font-semibold text-gray-700">{payload[0].name}</p>
                          <p className="font-bold" style={{ color: payload[0].payload.color }}>{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Detalle por operación */}
        {operaciones.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Detalle por operación
            </p>
            {operaciones.map(op => (
              <OperacionCard key={op.id} op={op} />
            ))}
          </div>
        )}

        {/* Recibos sin operación vinculada */}
        {recibos_directos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagos sin presupuesto vinculado</p>
            </div>
            <div className="divide-y divide-gray-50">
              {recibos_directos.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Receipt size={14} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{r.numero}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(r.fecha)} · {FORMA_PAGO[r.forma_pago] ?? r.forma_pago}
                      {r.concepto ? ` · ${r.concepto}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 font-mono shrink-0">
                    {formatCurrency(Number(r.monto_total))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total final */}
        <div className={cn(
          'rounded-xl border-2 p-5',
          totales.saldo <= 0.01 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
        )}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total presupuestado</p>
              <p className="text-base font-bold text-gray-800 font-mono">{formatCurrency(totales.presupuestado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total cobrado</p>
              <p className="text-base font-bold text-emerald-700 font-mono">{formatCurrency(totales.cobrado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Saldo pendiente</p>
              <p className={cn('text-base font-bold font-mono', totales.saldo > 0.01 ? 'text-amber-600' : 'text-gray-400')}>
                {formatCurrency(Math.max(0, totales.saldo))}
              </p>
            </div>
          </div>
          {totales.saldo <= 0.01 && (
            <div className="flex items-center justify-center gap-2 mt-3 text-emerald-700">
              <Check size={15} />
              <span className="text-sm font-semibold">Cuenta al día — sin saldo pendiente</span>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
