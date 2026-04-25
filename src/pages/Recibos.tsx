import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, Plus, Search, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Wallet, CreditCard, Landmark,
  Banknote, X, Ban, Edit2
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

function nombreCliente(c: Recibo['cliente']) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

export function Recibos() {
  const navigate = useNavigate();
  const [recibos, setRecibos]   = useState<Recibo[]>([]);
  const [conteos, setConteos]   = useState<Conteos>({ emitidos: 0, anulados: 0, monto_mes: 0, count_mes: 0 });
  const [search, setSearch]     = useState('');
  const [estado, setEstado]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [anulando, setAnulando] = useState<string | null>(null);

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

  async function anular(r: Recibo) {
    if (!confirm(`¿Anular recibo ${r.numero}? Esta acción no se puede deshacer.`)) return;
    setAnulando(r.id);
    try {
      await api.patch(`/recibos/${r.id}/anular`);
      toast.success(`Recibo ${r.numero} anulado`);
      cargar();
    } catch (e) {
      toast.error((e as Error).message || 'Error al anular');
    } finally {
      setAnulando(null);
    }
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

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-gray-400" />
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Número</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Fecha</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cliente</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Operación / Remito</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Forma de pago</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Monto</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recibos.map(r => {
                const FPIcon = FORMA_PAGO_ICON[r.forma_pago] ?? Wallet;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-700">{r.numero}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtFecha(r.fecha)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-800">{nombreCliente(r.cliente)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {r.operacion && (
                          <span className="text-xs font-mono text-sky-600">{r.operacion.numero}</span>
                        )}
                        {r.remito && (
                          <span className="text-xs font-mono text-teal-600">{r.remito.numero}</span>
                        )}
                        {!r.operacion && !r.remito && r.concepto && (
                          <span className="text-xs text-gray-400 italic truncate max-w-[160px]">{r.concepto}</span>
                        )}
                        {!r.operacion && !r.remito && !r.concepto && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <FPIcon size={12} className="text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-600">{FORMA_PAGO_LABEL[r.forma_pago] ?? r.forma_pago}</span>
                      </div>
                      {r.referencia_pago && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{r.referencia_pago}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-semibold tabular-nums', r.estado === 'anulado' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                        {formatCurrency(Number(r.monto_total))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        r.estado === 'emitido' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                        {r.estado === 'emitido' ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                        {r.estado === 'emitido' ? 'Emitido' : 'Anulado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {r.estado === 'emitido' && (
                          <>
                            <button onClick={() => navigate(`/recibos/${r.id}/editar`)}
                              title="Editar" className="p-1.5 hover:bg-sky-50 text-sky-500 rounded-lg transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => anular(r)} disabled={anulando === r.id}
                              title="Anular" className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors disabled:opacity-40">
                              {anulando === r.id ? <RefreshCw size={13} className="animate-spin" /> : <Ban size={13} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
