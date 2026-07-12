import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpButton } from '@/components/HelpButton';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import {
  Receipt, Plus, Search, RefreshCw, CheckCircle2, XCircle,
  Wallet, CreditCard, Landmark, Banknote, X, Ban, Pen,
  Printer, User, Package, AlertTriangle, MessageCircle,
  Clock, TrendingUp, AlertCircle, ChevronLeft, ChevronRight,
  Send, List,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ────────────────────────────────────────────────────────

interface ReciboRow {
  tipo: 'recibo';
  id: string;
  numero: string;
  fecha: string;
  monto_total: number;
  forma_pago: string;
  referencia_pago: string | null;
  estado: 'emitido' | 'anulado';
  estado_cobro: 'cobrado' | 'parcial' | 'anulado';
  saldo_pendiente: number;
  operacion_id: string | null;
  operacion_numero: string | null;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
}

interface CompromisoRow {
  tipo: 'compromiso';
  id: string;
  numero: string;
  fecha: string;
  fecha_vencimiento: string;
  monto_total: number;
  estado_cobro: 'pendiente' | 'vencido';
  descripcion: string | null;
  operacion_id: string | null;
  operacion_numero: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
}

type TablaRow = ReciboRow | CompromisoRow;
type EstadoCobro = 'cobrado' | 'parcial' | 'pendiente' | 'vencido' | 'anulado';

interface DeudasCliente {
  cliente_id: string;
  cliente_nombre: string;
  saldo_pendiente: number;
  tiene_vencido: boolean;
}

interface MetodoPago {
  grupo: string;
  count: number;
  total: number;
  pct: number;
}

interface ProximoVenc {
  cliente_nombre: string;
  operacion_numero: string | null;
  monto: number;
  fecha_vencimiento: string;
  dias_para_vencer: number;
}

interface InfoClave {
  total_comprobantes: number;
  recibos_emitidos: number;
  pagos_parciales: number;
  anulados: number;
}

interface Stats {
  cobrado_mes: number;
  count_mes: number;
  pendiente_cobro: number;
  vencido: number;
  dias_promedio: number;
  pct_cobro: number;
  total_a_cobrar: number;
}

interface TableroData {
  stats: Stats;
  recibos: ReciboRow[];
  compromisos: CompromisoRow[];
  deudas_cliente: DeudasCliente[];
  metodos_pago: MetodoPago[];
  proximos_vencimientos: ProximoVenc[];
  info_clave: InfoClave;
}

// ── Detalle de recibo (modal existente) ──────────────────────────

interface ReciboDetalle {
  id: string; numero: string; fecha: string; estado: 'emitido' | 'anulado';
  monto_total: number; forma_pago: string; referencia_pago: string | null;
  concepto: string | null; notas: string | null;
  cliente: {
    id: string; nombre: string | null; apellido: string | null;
    razon_social: string | null; tipo_persona: string;
    telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  operacion: { id: string; numero: string; precio_total: number } | null;
  remito: { id: string; numero: string } | null;
  items: { id: string; descripcion: string; cantidad: number; monto: number; producto_nombre: string | null }[];
  created_by_nombre: string | null;
  cobrado_operacion: number;
  total_descuentos_operacion: number;
  descuento_pct: number;
  monto_descuento: number;
  compromiso: { monto: number; fecha_vencimiento: string; tipo: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────

const FORMA_PAGO_ICON: Record<string, React.ElementType> = {
  efectivo: Banknote, transferencia: Landmark,
  cheque: CreditCard, tarjeta_debito: CreditCard,
  tarjeta_credito: CreditCard, mercadopago: Wallet, otro: Wallet,
};

function pagoIcon(forma: string): React.ElementType {
  if (forma.toLowerCase().includes('transfer')) return Landmark;
  if (forma.toLowerCase().includes('tarjeta') || forma.toLowerCase().includes('cuota')) return CreditCard;
  if (forma.toLowerCase().includes('contado') || forma.toLowerCase().includes('efectivo')) return Banknote;
  return FORMA_PAGO_ICON[forma] ?? Wallet;
}

function pagoLabel(forma: string) {
  const map: Record<string, string> = {
    efectivo: 'Efectivo', transferencia: 'Transferencia',
    cheque: 'Cheque', tarjeta_debito: 'Tarjeta débito',
    tarjeta_credito: 'Tarjeta crédito', mercadopago: 'MercadoPago', otro: 'Otro',
  };
  return map[forma] ?? forma;
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtFechaLarga(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function nombreClienteDetalle(c: ReciboDetalle['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

const ESTADO_LABEL: Record<EstadoCobro, string> = {
  cobrado: 'Cobrado', parcial: 'Parcial',
  pendiente: 'Pendiente', vencido: 'Vencido', anulado: 'Anulado',
};

const ESTADO_BG: Record<EstadoCobro, string> = {
  cobrado:  'bg-emerald-50 text-emerald-700',
  parcial:  'bg-amber-50 text-amber-700',
  pendiente:'bg-sky-50 text-sky-700',
  vencido:  'bg-red-50 text-red-600',
  anulado:  'bg-gray-100 text-gray-500',
};

const ESTADO_BORDER: Record<EstadoCobro, string> = {
  cobrado:  'border-l-emerald-400',
  parcial:  'border-l-amber-400',
  pendiente:'border-l-sky-400',
  vencido:  'border-l-red-500',
  anulado:  'border-l-gray-300',
};

// ── DonutChart ───────────────────────────────────────────────────

const DONUT_COLORS = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b'];

function DonutChart({ data }: { data: { label: string; pct: number; total: number }[] }) {
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
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={10} />
        {segments.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={10}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-(s.offset - circ / 4)}
            strokeLinecap="butt" />
        ))}
      </svg>
      <div className="space-y-1 flex-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-xs text-gray-600">{s.label}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-gray-800">{formatCurrency(s.total)}</span>
              <span className="text-[10px] text-gray-400 ml-1">({s.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal detalle recibo ─────────────────────────────────────────

function ReciboModal({ id, onClose, onAnulado }: {
  id: string; onClose: () => void; onAnulado: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [rec, setRec] = useState<ReciboDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [anulando, setAnulando]       = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    api.get<ReciboDetalle>(`/recibos/${id}`)
      .then(d => { setRec(d); setLoading(false); })
      .catch(err => { setError(err.message ?? 'Error al cargar'); setLoading(false); });
  }, [id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleAnular() {
    if (!rec) return;
    setAnulando(true);
    try {
      await api.patch(`/recibos/${id}/anular`);
      toast.success(`Recibo ${rec.numero} anulado`);
      onAnulado(id);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || 'Error al anular');
      setAnulando(false); setConfirmando(false);
    }
  }

  if (confirmando && rec) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-red-600 px-6 py-5 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <AlertTriangle size={28} className="text-white" />
            </div>
            <p className="text-white font-bold text-lg">Anular recibo</p>
            <p className="text-red-200 text-xs mt-1">Esta acción no se puede deshacer</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-red-500 font-medium mb-1">Recibo a anular</p>
              <p className="text-sm font-bold text-red-800">{rec.numero}</p>
              <p className="text-xs text-red-500 mt-0.5">{formatCurrency(Number(rec.monto_total))} · {pagoLabel(rec.forma_pago)}</p>
            </div>
            <p className="text-xs text-gray-500 text-center">El recibo quedará marcado como anulado y no podrá reactivarse.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmando(false)}
                className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleAnular} disabled={anulando}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2">
                {anulando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Anulando...</>
                  : <><Ban size={14} /> Sí, anular</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const esEmitido = rec?.estado === 'emitido';
  const saldo = rec?.operacion
    ? Math.max(0, Number(rec.operacion.precio_total) - Number(rec.cobrado_operacion ?? 0) - Number(rec.total_descuentos_operacion ?? 0))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Receipt size={16} className="text-emerald-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{rec?.numero ?? '...'}</span>
                {rec && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
                    rec.estado === 'emitido' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                    {rec.estado === 'emitido' ? 'Emitido' : 'Anulado'}
                  </span>
                )}
              </div>
              {rec && <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(rec.fecha)}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rec && (
              <>
                {esEmitido && (
                  <button onClick={() => navigate(`/recibos/${id}/editar`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                    <Pen size={13} /> Editar
                  </button>
                )}
                <button onClick={() => window.open(`/imprimir/recibo/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg font-medium">
                  <Printer size={13} /> PDF
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">
            <AlertTriangle size={16} className="mr-2" /> {error}
          </div>
        ) : rec ? (
          <div className="divide-y divide-gray-100">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <User size={13} className="text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">{nombreClienteDetalle(rec.cliente)}</p>
              {rec.cliente.documento_nro && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {rec.cliente.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'}: {rec.cliente.documento_nro}
                </p>
              )}
              <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                {rec.cliente.telefono && <span>{rec.cliente.telefono}</span>}
                {rec.cliente.email    && <span>{rec.cliente.email}</span>}
              </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Importe</p>
                <p className={cn('text-2xl font-bold tabular-nums',
                  rec.estado === 'anulado' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                  {formatCurrency(Number(rec.monto_total))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Forma de pago</p>
                <div className="flex items-center gap-1.5 justify-end">
                  {(() => { const Icon = pagoIcon(rec.forma_pago); return <Icon size={13} className="text-gray-500" />; })()}
                  <span className="text-sm font-semibold text-gray-800">{pagoLabel(rec.forma_pago)}</span>
                </div>
                {rec.referencia_pago && <p className="text-xs text-gray-400 mt-0.5">Ref: {rec.referencia_pago}</p>}
              </div>
            </div>

            {rec.concepto && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Concepto</p>
                <p className="text-sm text-gray-700">{rec.concepto}</p>
              </div>
            )}

            {rec.items.length > 0 && (
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package size={13} className="text-gray-400" />
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Detalle ({rec.items.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {rec.items.map((item, i) => (
                    <div key={item.id ?? i} className="flex items-center justify-between gap-3 text-sm py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-700 flex-1">{item.descripcion}</span>
                      <span className="font-semibold text-gray-900 tabular-nums shrink-0">
                        {formatCurrency(Number(item.monto))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rec.operacion && (
              <div className="px-5 py-4 bg-gray-50/60">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Operación vinculada</p>
                <div className="flex items-start gap-8 flex-wrap text-sm">
                  <div><span className="text-gray-500 text-xs">Nro: </span>
                    <span className="font-mono font-semibold text-sky-700">{rec.operacion.numero}</span></div>
                  <div><span className="text-gray-500 text-xs">Total: </span>
                    <span className="font-semibold text-gray-800">{formatCurrency(Number(rec.operacion.precio_total))}</span></div>
                  <div><span className="text-gray-500 text-xs">Cobrado: </span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(Number(rec.cobrado_operacion))}</span></div>
                  {Number(rec.monto_descuento) > 0.01 && (
                    <div><span className="text-gray-500 text-xs">
                      Bonificación {Number(rec.descuento_pct) % 1 === 0 ? Number(rec.descuento_pct).toFixed(0) : Number(rec.descuento_pct).toFixed(1)}%:{' '}
                    </span>
                      <span className="font-semibold text-violet-600">− {formatCurrency(Number(rec.monto_descuento))}</span>
                    </div>
                  )}
                  {saldo >= 0.01 && (
                    <div><span className="text-gray-500 text-xs">Saldo: </span>
                      <span className="font-bold text-red-600">{formatCurrency(saldo)}</span>
                      {rec.compromiso?.fecha_vencimiento && (
                        <span className="text-xs text-gray-500 ml-1.5">
                          — a cancelar el {fmtFechaLarga(rec.compromiso.fecha_vencimiento)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {rec.notas && (
              <div className="px-5 py-3">
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                  {rec.notas}
                </div>
              </div>
            )}

            {esEmitido && (
              <div className="px-5 py-3 bg-gray-50 rounded-b-2xl flex justify-end">
                <button onClick={() => setConfirmando(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-medium">
                  <Ban size={12} /> Anular recibo
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────

const PER_PAGE = 10;

type FiltroEstado = 'todos' | 'cobrado' | 'parcial' | 'anulado';

export function Recibos() {
  const navigate = useNavigate();
  const [data, setData]         = useState<TableroData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro]     = useState<FiltroEstado>('todos');
  const [page, setPage]         = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [enviandoWaIds, setEnviandoWaIds] = useState<Set<string>>(new Set());

  async function enviarMensajeWa(clienteId: string, mensaje: string) {
    setEnviandoWaIds(s => new Set(s).add(clienteId));
    try {
      await api.post(`/clientes/${clienteId}/enviar-mensaje-whatsapp`, { mensaje });
      toast.success('Mensaje enviado por WhatsApp');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al enviar WhatsApp');
    } finally {
      setEnviandoWaIds(s => { const n = new Set(s); n.delete(clienteId); return n; });
    }
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<TableroData>('/recibos/tablero');
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Solo recibos, ordenados por fecha desc
  const filas: ReciboRow[] = useMemo(() => {
    if (!data) return [];
    return [...data.recibos].sort((a, b) =>
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }, [data]);

  const conteos = useMemo(() => {
    const c: Record<string, number> = { cobrado: 0, parcial: 0, anulado: 0 };
    filas.forEach(f => { c[f.estado_cobro] = (c[f.estado_cobro] ?? 0) + 1; });
    return c;
  }, [filas]);

  const filtrado = useMemo(() => {
    let list = filas;
    if (filtro !== 'todos') list = list.filter(f => f.estado_cobro === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      list = list.filter(f =>
        f.numero.toLowerCase().includes(q) ||
        f.cliente_nombre.toLowerCase().includes(q) ||
        (f.operacion_numero ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [filas, filtro, busqueda]);

  const totalPages = Math.ceil(filtrado.length / PER_PAGE);
  const paginated  = filtrado.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleFiltro(f: FiltroEstado) { setFiltro(f); setPage(1); }
  function handleBusqueda(q: string) { setBusqueda(q); setPage(1); }
  function handleAnulado() { cargar(); }

  const { stats, deudas_cliente, metodos_pago, proximos_vencimientos, info_clave } = data ?? {
    stats: { cobrado_mes: 0, count_mes: 0, pendiente_cobro: 0, vencido: 0, dias_promedio: 0, pct_cobro: 0, total_a_cobrar: 0 },
    deudas_cliente: [], metodos_pago: [], proximos_vencimientos: [],
    info_clave: { total_comprobantes: 0, recibos_emitidos: 0, pagos_parciales: 0, anulados: 0 },
  };

  const donutData = metodos_pago.map(m => ({ label: m.grupo, pct: m.pct, total: m.total }));

  const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // KPI tiles
  const kpis = [
    {
      label: 'Total a cobrar',
      sub: `${stats.count_mes} recibos emitidos`,
      valor: formatCurrency(stats.total_a_cobrar),
      icon: TrendingUp, color: 'text-sky-600', bg: 'bg-sky-50',
    },
    {
      label: 'Cobrado este mes',
      sub: `${stats.pct_cobro}% del total`,
      valor: formatCurrency(stats.cobrado_mes),
      icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',
      progress: stats.pct_cobro,
    },
    {
      label: 'Pendiente de cobro',
      sub: `${stats.total_a_cobrar > 0 ? 100 - stats.pct_cobro : 0}% del total`,
      valor: formatCurrency(stats.pendiente_cobro),
      icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50',
    },
    {
      label: 'Vencido',
      sub: stats.total_a_cobrar > 0
        ? `${Math.round(stats.vencido / stats.total_a_cobrar * 100)}% del total`
        : '0% del total',
      valor: formatCurrency(stats.vencido),
      icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50',
    },
    {
      label: 'Días promedio de cobro',
      sub: mesActual,
      valor: `${stats.dias_promedio} días`,
      icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50',
    },
    {
      label: '% de cobro',
      sub: 'Objetivo: 80%',
      valor: `${stats.pct_cobro}%`,
      icon: TrendingUp, color: 'text-sky-600', bg: 'bg-sky-50',
      circular: stats.pct_cobro,
    },
  ];

  const TABS: { key: FiltroEstado; label: string }[] = [
    { key: 'todos',   label: 'Todos' },
    { key: 'cobrado', label: 'Cobrado' },
    { key: 'parcial', label: 'Parcial' },
    { key: 'anulado', label: 'Anulado' },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-5 max-w-[1400px] mx-auto space-y-4" data-section="recibos">
      <SectionHero
        section="recibos"
        icon={Receipt}
        title="Recibos"
        sub="Control de cobranzas y pagos"
        actions={<>
          <button onClick={cargar} className="p-2 hover:bg-white/70 rounded-xl text-gray-500">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <HelpButton topic="recibos" />
          <button onClick={() => navigate('/recibos/nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={14} /> Nuevo recibo
          </button>
        </>}
      />

      <CompactStatsBar items={[
        { value: formatCurrency(stats.total_a_cobrar), label: 'total a cobrar',    color: '#ffffff' },
        { value: formatCurrency(stats.cobrado_mes),    label: 'cobrado este mes',  color: '#34d399' },
        { value: formatCurrency(stats.pendiente_cobro),label: 'pendiente cobro',   color: '#fbbf24' },
        { value: formatCurrency(stats.vencido),        label: 'vencido',           color: '#f87171' },
        { value: `${stats.pct_cobro}%`,                label: 'tasa de cobro',     color: '#60a5fa' },
        { value: `${stats.dias_promedio}d`,            label: 'días prom. cobro',  color: '#c084fc' },
      ]} />

      {/* Layout principal */}
      <div className="flex flex-col xl:flex-row gap-4 xl:items-start">

        {/* Columna central */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Tabs + búsqueda */}
          <div className="bg-white rounded-2xl border border-gray-300 shadow-lg px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {TABS.map(t => {
                const count = t.key === 'todos' ? filas.length : (conteos[t.key] ?? 0);
                return (
                  <button key={t.key} onClick={() => handleFiltro(t.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      filtro === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                    )}>
                    {t.label}
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      filtro === t.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
                    )}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busqueda} onChange={e => handleBusqueda(e.target.value)}
                placeholder="Buscar por número, cliente o presupuesto..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {/* Lista */}
          <div className="bg-white rounded-2xl border border-gray-300 shadow-lg overflow-x-auto">
            {loading ? (
              <div className="p-3 space-y-1.5 min-w-[560px]">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 px-3 py-3 animate-pulse flex gap-3">
                    <div className="w-[76px] h-4 bg-gray-100 rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-40" />
                      <div className="h-3 bg-gray-100 rounded w-24" />
                    </div>
                    <div className="w-16 h-4 bg-gray-100 rounded shrink-0" />
                  </div>
                ))}
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-16 text-center">
                <Receipt size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">
                  {busqueda || filtro !== 'todos' ? 'Sin resultados' : 'No hay recibos aún'}
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-1.5 min-w-[560px]">
                {paginated.map(fila => {
                  const ec = fila.estado_cobro as EstadoCobro;
                  const FPIcon = pagoIcon(fila.forma_pago);
                  const waMsg = `Hola, te contactamos por el recibo ${fila.numero} por ${formatCurrency(fila.monto_total)}.`;

                  return (
                    <div key={fila.id}
                      className={cn(
                        'rounded-xl border border-gray-200 border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all',
                        ESTADO_BORDER[ec],
                      )}
                      onClick={() => setDetailId(fila.id)}
                    >
                      <div className="px-3 py-2.5 flex items-start gap-3">
                        {/* Número */}
                        <div className="shrink-0 w-[76px]">
                          <p className="font-mono text-[11px] text-gray-400">{fila.numero}</p>
                          <p className="text-[10px] text-gray-300 mt-0.5">{fmtFecha(fila.fecha)}</p>
                        </div>
                        {/* Main */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 truncate">{fila.cliente_nombre}</span>
                            <div className="flex-1 h-px bg-gray-200 mx-1 shrink min-w-4" />
                            {fila.operacion_numero
                              ? <span className="font-mono text-[11px] text-sky-600 shrink-0">{fila.operacion_numero}</span>
                              : null
                            }
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', ESTADO_BG[ec])}>
                              {ESTADO_LABEL[ec]}
                            </span>
                            <FPIcon size={11} className="text-gray-400 shrink-0" />
                            <span className="text-[10px] text-gray-500 truncate">{pagoLabel(fila.forma_pago)}</span>
                            {ec === 'parcial' && fila.saldo_pendiente > 0 && (
                              <span className="text-[10px] text-amber-600 font-semibold">Saldo: {formatCurrency(fila.saldo_pendiente)}</span>
                            )}
                          </div>
                          {ec === 'parcial' && fila.saldo_pendiente > 0 && fila.operacion_id && (
                            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => navigate(
                                  `/recibos/nuevo?operacion_id=${fila.operacion_id}` +
                                  `&monto=${Math.round(fila.saldo_pendiente)}` +
                                  `&concepto=${encodeURIComponent('Cancelación de saldo')}`
                                )}
                                className="text-[10px] text-amber-700 hover:text-white bg-amber-50 hover:bg-amber-500 border border-amber-300 rounded px-2 py-0.5 font-semibold transition-colors"
                              >
                                Cobrar saldo
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Monto + acciones */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className={cn('text-sm font-bold tabular-nums',
                            ec === 'anulado' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                            {formatCurrency(fila.monto_total)}
                          </span>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {fila.cliente_telefono && (
                              <button
                                onClick={() => enviarMensajeWa(fila.cliente_id, waMsg)}
                                disabled={enviandoWaIds.has(fila.cliente_id)}
                                className="p-1 rounded hover:bg-green-50 text-green-600 disabled:opacity-60 transition-colors" title="Enviar WhatsApp">
                                {enviandoWaIds.has(fila.cliente_id)
                                  ? <span className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin inline-block" />
                                  : <MessageCircle size={13} />}
                              </button>
                            )}
                            <button onClick={() => window.open(`/imprimir/recibo/${fila.id}`, '_blank')}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                              <Printer size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {filtrado.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Mostrando {(page - 1) * PER_PAGE + 1} a {Math.min(page * PER_PAGE, filtrado.length)} de {filtrado.length}
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
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sección inferior — próximos vencimientos + info clave */}
          <div className="grid grid-cols-2 gap-4">

            {/* Próximos vencimientos */}
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-800">Próximos vencimientos</p>
              </div>
              {proximos_vencimientos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Sin vencimientos próximos</p>
              ) : (
                <div className="space-y-2.5">
                  {proximos_vencimientos.map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{v.cliente_nombre}</p>
                        {v.operacion_numero && (
                          <p className="text-[10px] text-sky-600 font-mono">{v.operacion_numero}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-gray-900">{formatCurrency(v.monto)}</p>
                        <p className={cn('text-[10px]',
                          v.dias_para_vencer === 0 ? 'text-red-500 font-semibold' :
                          v.dias_para_vencer <= 2  ? 'text-amber-500 font-semibold' : 'text-gray-400')}>
                          {v.dias_para_vencer === 0 ? 'Vence hoy' :
                           v.dias_para_vencer === 1 ? 'Vence mañana' :
                           `Vence en ${v.dias_para_vencer} días`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Información clave */}
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Información clave</p>
              <div className="space-y-2">
                {[
                  { label: 'Total comprobantes (este mes)', value: info_clave.total_comprobantes },
                  { label: 'Recibos emitidos',             value: info_clave.recibos_emitidos },
                  { label: 'Pagos parciales (con saldo)',   value: info_clave.pagos_parciales },
                  { label: 'Comprobantes anulados',         value: info_clave.anulados },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <p className="text-xs text-gray-600">{row.label}</p>
                    <p className="text-sm font-bold text-gray-900">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full xl:w-[260px] xl:shrink-0 space-y-4">

          {/* Deudas por cliente */}
          <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">Deudas por cliente</p>
            </div>
            {deudas_cliente.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Sin deudas pendientes</p>
            ) : (
              <div className="space-y-2.5">
                {deudas_cliente.map((d, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-700 leading-tight flex-1">{d.cliente_nombre}</p>
                    <div className="text-right shrink-0">
                      <p className={cn('text-xs font-bold', d.tiene_vencido ? 'text-red-600' : 'text-amber-600')}>
                        {formatCurrency(d.saldo_pendiente)}
                      </p>
                      <p className={cn('text-[9px] font-semibold', d.tiene_vencido ? 'text-red-500' : 'text-amber-500')}>
                        {d.tiene_vencido ? 'Vencido' : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Métodos de pago */}
          {donutData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">Métodos de pago (este mes)</p>
              <DonutChart data={donutData} />
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="bg-white rounded-2xl border border-gray-300 shadow-lg p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">Acciones rápidas</p>
            <div className="space-y-1">
              {[
                { icon: Plus,     label: 'Nuevo recibo',             action: () => navigate('/recibos/nuevo') },
                { icon: Wallet,   label: 'Registrar pago parcial',   action: () => navigate('/recibos/nuevo?modo=parcial') },
                { icon: Send,     label: 'Enviar recordatorio',      action: () => navigate('/estado-cuenta') },
                { icon: List,     label: 'Ver cuentas por cobrar',   action: () => navigate('/estado-cuenta') },
                { icon: Printer,  label: 'Reporte de cobranzas',     action: () => handleFiltro('cobrado') },
              ].map((a, i) => {
                const Icon = a.icon;
                return (
                  <button key={i} onClick={a.action}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <Icon size={13} className="text-emerald-600 shrink-0" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {detailId && (
        <ReciboModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onAnulado={handleAnulado}
        />
      )}
    </div>
  );
}
