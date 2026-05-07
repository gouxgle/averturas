import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Printer, Receipt, Truck, DollarSign, FileText,
  ChevronDown, ChevronUp, Check, AlertTriangle, Clock, Calendar,
  CreditCard, ArrowDownLeft, ArrowUpRight, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const NAVY = '#031d49';

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
  color: string | null; tipo_abertura: string | null; sistema: string | null;
}

interface ReciboResumen {
  id: string; numero: string; fecha: string;
  monto_total: number; forma_pago: string;
  concepto: string | null; estado: string; operacion_id: string | null;
}

interface RemitoResumen {
  id: string; numero: string; fecha_emision: string;
  estado: string; operacion_id: string | null;
  medio_envio: string; fecha_entrega_real: string | null;
}

interface Compromiso {
  id: string; tipo: string; monto: number;
  fecha_vencimiento: string; descripcion: string | null;
  numero_cheque: string | null; banco: string | null;
  estado: 'pendiente' | 'cobrado' | 'rechazado' | 'vencido';
  operacion: { id: string; numero: string } | null;
}

interface OperacionDetalle {
  id: string; numero: string; tipo: string; estado: string;
  precio_total: number; created_at: string;
  notas: string | null; forma_pago: string | null;
  items: OpItem[];
  recibos: ReciboResumen[];
  remitos: RemitoResumen[];
  cobrado: number | null;
  saldo: number | null;
  genera_saldo: boolean;
}

interface EstadoCuentaData {
  cliente: ClienteInfo;
  operaciones: OperacionDetalle[];
  recibos_directos: ReciboResumen[];
  compromisos: Compromiso[];
  totales: { presupuestado: number; cobrado: number; saldo: number; pendiente_aprobacion: number };
}

// ── Ledger ───────────────────────────────────────────────────
interface Movimiento {
  fecha: string;
  tipo: 'cargo' | 'abono';
  numero: string;
  concepto: string;
  monto: number;
  saldo: number;
}

function buildLedger(operaciones: OperacionDetalle[], recibosDirectos: ReciboResumen[]): Movimiento[] {
  const entries: Omit<Movimiento, 'saldo'>[] = [];

  for (const op of operaciones) {
    if (!op.genera_saldo) continue;
    const resumen = op.items.length > 0
      ? op.items.map(i => i.tipo_abertura ?? i.descripcion).filter(Boolean).slice(0, 3).join(', ')
      : 'Operación';
    entries.push({
      fecha: op.created_at,
      tipo: 'cargo',
      numero: op.numero,
      concepto: resumen,
      monto: Number(op.precio_total),
    });
    for (const r of op.recibos) {
      entries.push({
        fecha: r.fecha,
        tipo: 'abono',
        numero: r.numero,
        concepto: r.forma_pago + (r.concepto ? ` · ${r.concepto}` : ''),
        monto: Number(r.monto_total),
      });
    }
  }
  for (const r of recibosDirectos) {
    entries.push({
      fecha: r.fecha,
      tipo: 'abono',
      numero: r.numero,
      concepto: r.forma_pago + (r.concepto ? ` · ${r.concepto}` : ''),
      monto: Number(r.monto_total),
    });
  }

  entries.sort((a, b) => a.fecha.localeCompare(b.fecha));

  let saldo = 0;
  return entries.map(e => {
    saldo = e.tipo === 'cargo' ? saldo + e.monto : saldo - e.monto;
    return { ...e, saldo };
  });
}

// ── Helpers ──────────────────────────────────────────────────
const ESTADO_OP_COLOR: Record<string, string> = {
  presupuesto: 'bg-gray-100 text-gray-700', enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700', rechazado: 'bg-red-100 text-red-700',
  en_produccion: 'bg-amber-100 text-amber-700', listo: 'bg-teal-100 text-teal-700',
  instalado: 'bg-purple-100 text-purple-700', entregado: 'bg-indigo-100 text-indigo-700',
};
const ESTADO_OP_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto', enviado: 'Enviado', aprobado: 'Aprobado',
  rechazado: 'Rechazado', en_produccion: 'En producción', listo: 'Listo',
  instalado: 'Instalado', entregado: 'Entregado',
};

const COMP_TIPO: Record<string, string> = {
  cuota: 'Cuota', cheque: 'Cheque', efectivo_futuro: 'Efectivo futuro', transferencia: 'Transferencia',
};
const COMP_ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  cobrado:   'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-red-100 text-red-700',
  vencido:   'bg-red-200 text-red-800',
};

function clienteNombre(c: ClienteInfo) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function isVencido(fecha: string) {
  return new Date(fecha) < new Date(new Date().toDateString());
}

// ── Componente operación colapsable ─────────────────────────
function OperacionCard({ op }: { op: OperacionDetalle }) {
  const [open, setOpen] = useState(false);
  const cobrado = Number(op.cobrado ?? 0);
  const saldo = op.saldo !== null ? Number(op.saldo) : null;
  const saldada = saldo !== null && saldo <= 0.01;
  const pct = op.genera_saldo && op.precio_total
    ? Math.min(100, Math.round((cobrado / Number(op.precio_total)) * 100))
    : 0;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      op.genera_saldo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-75'
    )}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
        <FileText size={14} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">{op.numero}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', ESTADO_OP_COLOR[op.estado])}>
              {ESTADO_OP_LABEL[op.estado] ?? op.estado}
            </span>
            <span className="text-xs text-gray-400">{formatDate(op.created_at)}</span>
          </div>
          {op.genera_saldo && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', saldada ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200')}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-gray-500">{pct}%</span>
            </div>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-sm font-bold text-gray-800 font-mono">{formatCurrency(Number(op.precio_total))}</p>
          {op.genera_saldo && !saldada && saldo !== null && (
            <p className="text-[10px] text-amber-600 font-medium">Saldo: {formatCurrency(saldo)}</p>
          )}
          {op.genera_saldo && saldada && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-0.5 justify-end">
              <Check size={9} /> Saldado
            </p>
          )}
        </div>
        {open ? <ChevronUp size={13} className="text-gray-400 shrink-0" /> : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {op.items.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ítems</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1 font-semibold text-gray-500 pr-3">Descripción</th>
                    <th className="text-center py-1 font-semibold text-gray-500 w-10">Cant.</th>
                    <th className="text-right py-1 font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {op.items.map((item, i) => (
                    <tr key={item.id ?? i}>
                      <td className="py-1.5 pr-3">
                        <p className="font-medium text-gray-800">{item.tipo_abertura ?? item.descripcion}</p>
                        <p className="text-[10px] text-gray-400">
                          {[item.sistema, item.medida_ancho && item.medida_alto
                            ? `${item.medida_ancho}×${item.medida_alto}m` : null,
                            item.color, item.incluye_instalacion ? 'c/instalación' : null]
                            .filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="py-1.5 text-center text-gray-600">{item.cantidad}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-800 font-mono">
                        {formatCurrency(Number(item.precio_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {op.remitos.length > 0 && (
            <div className="px-4 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Entregas</p>
              <div className="flex flex-wrap gap-2">
                {op.remitos.map(rm => (
                  <div key={rm.id} className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-2.5 py-1.5 text-xs">
                    <Truck size={11} className="text-blue-500" />
                    <span className="font-semibold text-blue-800">{rm.numero}</span>
                    <span className="text-gray-500">
                      {rm.estado === 'entregado' && rm.fecha_entrega_real
                        ? `Entregado ${formatDate(rm.fecha_entrega_real)}`
                        : ESTADO_OP_LABEL[rm.estado] ?? rm.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
  if (!data) return (
    <div className="p-6 max-w-4xl mx-auto text-center py-20">
      <p className="text-gray-400">No encontrado</p>
      <Link to="/clientes" className="text-emerald-600 text-sm mt-2 hover:underline block">Volver a clientes</Link>
    </div>
  );

  const { cliente, operaciones, recibos_directos, compromisos, totales } = data;
  const nombre = clienteNombre(cliente);
  const ledger = buildLedger(operaciones, recibos_directos);
  const saldo = totales.saldo;
  const saldoNegativo = saldo < -0.01; // pagó de más
  const saldado = Math.abs(saldo) <= 0.01;
  const pctGlobal = totales.presupuestado > 0
    ? Math.min(100, Math.round((totales.cobrado / totales.presupuestado) * 100))
    : 0;

  const compPendientes = compromisos.filter(c => c.estado === 'pendiente');
  const compVencidos = compPendientes.filter(c => isVencido(c.fecha_vencimiento));
  const compFuturos = compPendientes.filter(c => !isVencido(c.fecha_vencimiento));
  const totalCompromisos = compPendientes.reduce((s, c) => s + Number(c.monto), 0);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 16mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 no-print">
          <Link to={`/clientes/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Estado de Cuenta</h1>
            <p className="text-sm text-gray-500">{nombre}</p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Printer size={14} /> Imprimir
          </button>
        </div>

        {/* Encabezado impresión */}
        <div className="hidden print:block mb-4 pb-4 border-b-2" style={{ borderColor: NAVY }}>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Estado de Cuenta</p>
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>{nombre}</h2>
          <div className="flex gap-6 mt-1 text-xs text-gray-500">
            {cliente.documento_nro && <span>DNI/CUIT: {cliente.documento_nro}</span>}
            {cliente.telefono && <span>Tel: {cliente.telefono}</span>}
            {cliente.email && <span>{cliente.email}</span>}
            {cliente.localidad && <span>{cliente.localidad}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Generado: {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>

        {/* Resumen financiero */}
        <div className={cn(
          'rounded-xl border-2 p-5',
          saldado ? 'bg-emerald-50 border-emerald-200'
          : saldoNegativo ? 'bg-blue-50 border-blue-200'
          : 'bg-amber-50 border-amber-200'
        )}>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total facturado</p>
              <p className="text-xl font-bold text-gray-800 font-mono">{formatCurrency(totales.presupuestado)}</p>
              {totales.pendiente_aprobacion > 0 && (
                <p className="text-[10px] text-amber-500 font-medium mt-0.5">
                  +{formatCurrency(totales.pendiente_aprobacion)} pendiente aprobación
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total cobrado</p>
              <p className="text-xl font-bold text-emerald-700 font-mono">{formatCurrency(totales.cobrado)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{pctGlobal}% del total</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Saldo</p>
              <p className={cn('text-xl font-bold font-mono',
                saldado ? 'text-emerald-600'
                : saldoNegativo ? 'text-blue-600'
                : 'text-amber-600')}>
                {saldoNegativo ? `(${formatCurrency(Math.abs(saldo))})` : formatCurrency(Math.max(0, saldo))}
              </p>
              <p className={cn('text-[10px] mt-0.5',
                saldado ? 'text-emerald-600' : saldoNegativo ? 'text-blue-600' : 'text-amber-600')}>
                {saldado ? '✓ Sin deuda' : saldoNegativo ? 'A favor del cliente' : 'Pendiente de cobro'}
              </p>
            </div>
          </div>
          {/* Barra de progreso */}
          {totales.presupuestado > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-white">
                <div className={cn('h-full rounded-full transition-all', saldado ? 'bg-emerald-500' : 'bg-amber-400')}
                  style={{ width: `${pctGlobal}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-600 shrink-0">{pctGlobal}% cobrado</span>
            </div>
          )}
          {/* Compromisos pendientes como referencia */}
          {totalCompromisos > 0 && (
            <div className={cn(
              'mt-3 pt-3 border-t flex items-center gap-2 text-xs',
              compVencidos.length > 0 ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'
            )}>
              <Calendar size={12} className="shrink-0" />
              <span className="font-medium">
                {compVencidos.length > 0
                  ? `${compVencidos.length} compromiso${compVencidos.length !== 1 ? 's' : ''} vencido${compVencidos.length !== 1 ? 's' : ''} — `
                  : ''}
                {formatCurrency(totalCompromisos)} comprometido${compFuturos.length > 0 ? ` (próximo: ${formatDate(compFuturos[0].fecha_vencimiento)})` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Ledger — libro de movimientos */}
        {ledger.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cuenta corriente</p>
              <p className="text-xs text-gray-400">{ledger.length} movimientos</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-2 px-4 font-semibold text-gray-500 w-24">Fecha</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-500 w-28">Documento</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-500">Concepto</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 w-28">Cargo</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 w-28">Abono</th>
                    <th className="text-right py-2 px-4 font-semibold text-gray-500 w-28">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ledger.map((mov, i) => (
                    <tr key={i} className={cn(
                      'hover:bg-gray-50 transition-colors',
                      mov.tipo === 'abono' && 'bg-emerald-50/30'
                    )}>
                      <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                        {formatDate(mov.fecha)}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1.5">
                          {mov.tipo === 'cargo'
                            ? <ArrowUpRight size={12} className="text-amber-500 shrink-0" />
                            : <ArrowDownLeft size={12} className="text-emerald-500 shrink-0" />}
                          <span className={cn('font-semibold', mov.tipo === 'cargo' ? 'text-gray-700' : 'text-emerald-700')}>
                            {mov.numero}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 max-w-[200px] truncate">
                        {mov.concepto}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {mov.tipo === 'cargo'
                          ? <span className="font-semibold text-gray-800">{formatCurrency(mov.monto)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {mov.tipo === 'abono'
                          ? <span className="font-semibold text-emerald-700">{formatCurrency(mov.monto)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={cn(
                        'py-2.5 px-4 text-right font-mono font-bold',
                        mov.saldo <= 0.01 ? 'text-emerald-600' : 'text-gray-800'
                      )}>
                        {formatCurrency(Math.max(0, mov.saldo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="py-2.5 px-4 text-xs font-semibold text-gray-500">SALDO ACTUAL</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-700">
                      {formatCurrency(totales.presupuestado)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatCurrency(totales.cobrado)}
                    </td>
                    <td className={cn(
                      'py-2.5 px-4 text-right font-mono font-bold text-sm',
                      saldado ? 'text-emerald-600' : 'text-amber-600'
                    )}>
                      {formatCurrency(Math.max(0, saldo))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Compromisos de pago */}
        {compromisos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compromisos de pago</p>
            </div>
            <div className="divide-y divide-gray-50">
              {compromisos.map(comp => {
                const vencido = comp.estado === 'pendiente' && isVencido(comp.fecha_vencimiento);
                return (
                  <div key={comp.id} className={cn(
                    'flex items-center gap-3 px-5 py-3',
                    vencido && 'bg-red-50'
                  )}>
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      comp.tipo === 'cheque' ? 'bg-blue-100' : 'bg-amber-100'
                    )}>
                      {comp.tipo === 'cheque'
                        ? <CreditCard size={14} className="text-blue-600" />
                        : <DollarSign size={14} className="text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800">
                          {COMP_TIPO[comp.tipo] ?? comp.tipo}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', COMP_ESTADO_COLOR[comp.estado])}>
                          {comp.estado === 'vencido' || vencido ? 'VENCIDO' : comp.estado}
                        </span>
                        {comp.operacion && (
                          <span className="text-[10px] text-gray-400">{comp.operacion.numero}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={9} /> {formatDate(comp.fecha_vencimiento)}
                        </span>
                        {comp.descripcion && <span>{comp.descripcion}</span>}
                        {comp.banco && <span>{comp.banco}</span>}
                        {comp.numero_cheque && <span>Ch. {comp.numero_cheque}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-sm font-bold font-mono',
                        comp.estado === 'cobrado' ? 'text-emerald-600'
                        : vencido ? 'text-red-600'
                        : 'text-gray-800'
                      )}>
                        {formatCurrency(Number(comp.monto))}
                      </p>
                      {comp.estado === 'cobrado' && (
                        <p className="text-[10px] text-emerald-600 flex items-center gap-0.5 justify-end">
                          <Check size={9} /> Cobrado
                        </p>
                      )}
                      {(comp.estado === 'rechazado') && (
                        <p className="text-[10px] text-red-500 flex items-center gap-0.5 justify-end">
                          <XCircle size={9} /> Rechazado
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {compPendientes.length > 0 && (
              <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {compPendientes.length} pendiente{compPendientes.length !== 1 ? 's' : ''}
                  {compVencidos.length > 0 && (
                    <span className="ml-2 text-red-600 font-semibold">
                      ({compVencidos.length} vencido{compVencidos.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </span>
                <span className="text-xs font-bold text-gray-700 font-mono">{formatCurrency(totalCompromisos)}</span>
              </div>
            )}
          </div>
        )}

        {/* Detalle por operación (colapsable, secundario) */}
        {operaciones.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              Detalle por operación
            </p>
            <div className="space-y-2">
              {operaciones.map(op => <OperacionCard key={op.id} op={op} />)}
            </div>
          </div>
        )}

        {/* Recibos sin operación */}
        {recibos_directos.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pagos sin operación vinculada</p>
            </div>
            <div className="divide-y divide-gray-50">
              {recibos_directos.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <Receipt size={14} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{r.numero}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(r.fecha)} · {r.forma_pago}{r.concepto ? ` · ${r.concepto}` : ''}
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

        {/* Estado final */}
        {ledger.length === 0 && compromisos.length === 0 && (
          <div className="text-center py-12">
            <Clock size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Sin movimientos financieros todavía.</p>
            <p className="text-xs text-gray-300 mt-1">Los movimientos aparecen cuando se aprueban operaciones.</p>
          </div>
        )}

      </div>
    </>
  );
}
