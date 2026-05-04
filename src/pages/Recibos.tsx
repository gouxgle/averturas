import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, Plus, Search, RefreshCw,
  CheckCircle2, XCircle, Wallet, CreditCard, Landmark,
  Banknote, X, Ban, Pen, Printer, User, Package,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Recibo {
  id: string;
  numero: string;
  fecha: string;
  cliente_id: string;
  cliente: { id: string; nombre: string | null; apellido: string | null; razon_social: string | null; tipo_persona: string };
  operacion_id: string | null;
  operacion: { id: string; numero: string; precio_total: number } | null;
  remito_id: string | null;
  remito: { id: string; numero: string } | null;
  monto_total: number;
  forma_pago: string;
  referencia_pago: string | null;
  concepto: string | null;
  estado: 'emitido' | 'anulado';
  notas: string | null;
  created_at: string;
}

interface ReciboDetalle extends Recibo {
  cliente: {
    id: string; nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  items: { id: string; descripcion: string; cantidad: number; monto: number; producto_nombre: string | null }[];
  created_by_nombre: string | null;
  cobrado_operacion: number;
  compromiso: { monto: number; fecha_vencimiento: string; tipo: string } | null;
}

interface Conteos {
  emitidos: number;
  anulados: number;
  monto_mes: number;
  count_mes: number;
}

const FORMA_PAGO_LABEL: Record<string, string> = {
  efectivo:       'Efectivo',
  transferencia:  'Transferencia',
  cheque:         'Cheque',
  tarjeta_debito: 'Tarjeta débito',
  tarjeta_credito:'Tarjeta crédito',
  mercadopago:    'MercadoPago',
  otro:           'Otro',
};

const FORMA_PAGO_ICON: Record<string, React.ElementType> = {
  efectivo:       Banknote,
  transferencia:  Landmark,
  cheque:         CreditCard,
  tarjeta_debito: CreditCard,
  tarjeta_credito:CreditCard,
  mercadopago:    Wallet,
  otro:           Wallet,
};

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtFechaLarga(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function nombreCliente(c: Recibo['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function pagoLabel(forma: string) {
  return FORMA_PAGO_LABEL[forma] ?? forma;
}

function pagoIcon(forma: string): React.ElementType {
  if (forma.toLowerCase().includes('transfer')) return Landmark;
  if (forma.toLowerCase().includes('tarjeta') || forma.toLowerCase().includes('cuota')) return CreditCard;
  if (forma.toLowerCase().includes('contado')) return Banknote;
  return FORMA_PAGO_ICON[forma] ?? Wallet;
}

// ── Modal de detalle ─────────────────────────────────────────────
function ReciboModal({
  id, onClose, onAnulado,
}: {
  id: string;
  onClose: () => void;
  onAnulado: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [rec, setRec] = useState<ReciboDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando]       = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get<ReciboDetalle>(`/recibos/${id}`)
      .then(d => { setRec(d); setLoading(false); })
      .catch(err => { setError(err.message ?? 'Error al cargar'); setLoading(false); });
  }, [id]);

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
      setAnulando(false);
      setConfirmando(false);
    }
  }

  // ── Pantalla de confirmación de anulación ──────────────────────
  if (confirmando && rec) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-red-600 px-6 py-5 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <AlertTriangle size={28} className="text-white" />
            </div>
            <p className="text-white font-bold text-lg leading-tight">Anular recibo</p>
            <p className="text-red-200 text-xs mt-1">Esta acción no se puede deshacer</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-red-500 font-medium mb-1">Recibo a anular</p>
              <p className="text-sm font-bold text-red-800">{rec.numero}</p>
              <p className="text-xs text-red-500 mt-0.5">{formatCurrency(Number(rec.monto_total))} · {pagoLabel(rec.forma_pago)}</p>
            </div>
            <p className="text-xs text-gray-500 text-center">
              El recibo quedará marcado como anulado y no podrá reactivarse.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmando(false)}
                className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnular}
                disabled={anulando}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {anulando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Anulando...</>
                  : <><Ban size={14} /> Sí, anular</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const esEmitido = rec?.estado === 'emitido';
  const esCuotas  = rec?.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';

  const saldo = rec?.operacion
    ? Math.max(0, Number(rec.operacion.precio_total) - Number(rec.cobrado_operacion ?? 0))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-10">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Receipt size={16} className="text-emerald-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{rec?.numero ?? '...'}</span>
                {rec && (
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-semibold',
                    rec.estado === 'emitido' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                  )}>
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
                  <button
                    onClick={() => navigate(`/recibos/${id}/editar`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-medium transition-colors"
                  >
                    <Pen size={13} /> Editar
                  </button>
                )}
                <button
                  onClick={() => window.open(`/imprimir/recibo/${id}`, '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg font-medium transition-colors"
                >
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

            {/* Cliente */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <User size={13} className="text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</p>
              </div>
              <p className="text-sm font-semibold text-gray-900">{nombreCliente(rec.cliente)}</p>
              {rec.cliente.documento_nro && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {rec.cliente.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'}: {rec.cliente.documento_nro}
                </p>
              )}
              <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                {rec.cliente.telefono && <span>{rec.cliente.telefono}</span>}
                {rec.cliente.email    && <span>{rec.cliente.email}</span>}
                {(rec.cliente.direccion || rec.cliente.localidad) && (
                  <span>{[rec.cliente.direccion, rec.cliente.localidad].filter(Boolean).join(', ')}</span>
                )}
              </div>
            </div>

            {/* Monto + Pago */}
            <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Importe</p>
                <p className={cn(
                  'text-2xl font-bold tabular-nums',
                  rec.estado === 'anulado' ? 'text-gray-400 line-through' : 'text-gray-900'
                )}>
                  {formatCurrency(Number(rec.monto_total))}
                </p>
                {esCuotas && rec.estado === 'emitido' && (
                  <p className="text-xs text-violet-600 font-semibold mt-1">
                    3 cuotas de {formatCurrency(Number(rec.monto_total) / 3)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Forma de pago</p>
                <div className="flex items-center gap-1.5 justify-end">
                  {(() => { const Icon = pagoIcon(rec.forma_pago); return <Icon size={13} className="text-gray-500" />; })()}
                  <span className="text-sm font-semibold text-gray-800">{pagoLabel(rec.forma_pago)}</span>
                </div>
                {rec.referencia_pago && (
                  <p className="text-xs text-gray-400 mt-0.5">Ref: {rec.referencia_pago}</p>
                )}
              </div>
            </div>

            {/* Concepto */}
            {rec.concepto && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Concepto</p>
                <p className="text-sm text-gray-700">{rec.concepto}</p>
              </div>
            )}

            {/* Items */}
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

            {/* Operación vinculada */}
            {rec.operacion && (
              <div className="px-5 py-4 bg-gray-50/60">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Operación vinculada
                </p>
                <div className="flex items-start gap-8 flex-wrap text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Presupuesto: </span>
                    <span className="font-mono font-semibold text-sky-700">{rec.operacion.numero}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Total operación: </span>
                    <span className="font-semibold text-gray-800">{formatCurrency(Number(rec.operacion.precio_total))}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Cobrado: </span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(Number(rec.cobrado_operacion))}</span>
                  </div>
                  {saldo >= 0.01 && (
                    <div>
                      <span className="text-gray-500 text-xs">Saldo: </span>
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

            {/* Notas */}
            {rec.notas && (
              <div className="px-5 py-3">
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                  {rec.notas}
                </div>
              </div>
            )}

            {/* Footer: anular */}
            {esEmitido && (
              <div className="px-5 py-3 bg-gray-50 rounded-b-2xl flex justify-end">
                <button
                  onClick={() => setConfirmando(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-medium transition-colors"
                >
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
export function Recibos() {
  const navigate = useNavigate();
  const [recibos, setRecibos]   = useState<Recibo[]>([]);
  const [conteos, setConteos]   = useState<Conteos>({ emitidos: 0, anulados: 0, monto_mes: 0, count_mes: 0 });
  const [search, setSearch]     = useState('');
  const [estado, setEstado]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ search, ...(estado ? { estado } : {}) }).toString();
      const [data, cnt] = await Promise.all([
        api.get<Recibo[]>(`/recibos?${qs}`),
        api.get<Conteos>('/recibos/conteos'),
      ]);
      setRecibos(data);
      setConteos(cnt);
    } finally {
      setLoading(false);
    }
  }, [search, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  function handleAnulado(id: string) {
    setRecibos(prev => prev.map(r => r.id === id ? { ...r, estado: 'anulado' as const } : r));
    cargar();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Receipt size={20} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recibos</h1>
            <p className="text-sm text-gray-500">Registro de cobros</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargar} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500" title="Actualizar">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => navigate('/recibos/nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
            <Plus size={14} /> Nuevo recibo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Cobrado este mes</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(Number(conteos.monto_mes))}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{conteos.count_mes} recibos emitidos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Emitidos</p>
            <p className="text-xl font-bold text-gray-900">{conteos.emitidos}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <XCircle size={22} className="text-red-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Anulados</p>
            <p className="text-xl font-bold text-gray-900">{conteos.anulados}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por número o cliente..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[{ v: '', l: 'Todos' }, { v: 'emitido', l: 'Emitidos' }, { v: 'anulado', l: 'Anulados' }].map(f => (
            <button key={f.v} onClick={() => setEstado(f.v)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                estado === f.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse border-b border-gray-50 last:border-0">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : recibos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <Receipt size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">
            {search || estado ? 'Sin resultados para la búsqueda' : 'Aún no hay recibos registrados'}
          </p>
          {!search && !estado && (
            <button onClick={() => navigate('/recibos/nuevo')}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium">
              Crear primer recibo
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {recibos.map(r => {
              const FPIcon = pagoIcon(r.forma_pago);
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group cursor-pointer"
                  onClick={() => setDetailId(r.id)}
                >
                  {/* Número + fecha */}
                  <div className="w-36 shrink-0">
                    <span className="font-mono text-sm font-bold text-gray-800 group-hover:text-emerald-600 transition-colors">
                      {r.numero}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(r.fecha)}</p>
                  </div>

                  {/* Cliente */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{nombreCliente(r.cliente)}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      {r.operacion && (
                        <span className="font-mono text-sky-600">{r.operacion.numero}</span>
                      )}
                      {r.concepto && !r.operacion && (
                        <span className="italic truncate max-w-[200px]">{r.concepto}</span>
                      )}
                    </div>
                  </div>

                  {/* Forma de pago */}
                  <div className="hidden sm:flex items-center gap-1.5 w-44 shrink-0">
                    <FPIcon size={12} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-600 truncate">{pagoLabel(r.forma_pago)}</span>
                  </div>

                  {/* Monto */}
                  <div className="text-right w-28 shrink-0">
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      r.estado === 'anulado' ? 'text-gray-400 line-through' : 'text-gray-900'
                    )}>
                      {formatCurrency(Number(r.monto_total))}
                    </span>
                  </div>

                  {/* Estado */}
                  <div className="shrink-0">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                      r.estado === 'emitido' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    )}>
                      {r.estado === 'emitido' ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                      {r.estado === 'emitido' ? 'Emitido' : 'Anulado'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
