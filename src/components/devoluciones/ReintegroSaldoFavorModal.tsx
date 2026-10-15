import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Banknote, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn, formatCurrency } from '@/lib/utils';
import { FORMAS_REINTEGRO, type FormaReintegro } from '@/lib/devolucion';

// Devolver en dinero un saldo a favor que el cliente ya tenía (efectivo, transferencia…).
// Lo puede hacer un vendedor o un admin; le llega un aviso al administrador.
export function ReintegroSaldoFavorModal({ clienteId, clienteNombre, saldo, onClose, onDone }: {
  clienteId: string; clienteNombre: string; saldo: number; onClose: () => void; onDone: () => void;
}) {
  const [monto, setMonto] = useState(String(saldo));
  const [forma, setForma] = useState<FormaReintegro>('Efectivo');
  const [referencia, setReferencia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, enviando]);

  const montoNum = parseFloat(monto) || 0;
  const invalido = montoNum <= 0 || montoNum > saldo + 0.009 || motivo.trim().length < 3;

  async function confirmar() {
    setEnviando(true);
    try {
      const r = await api.post<{ numero: string }>(`/clientes/${clienteId}/saldo-favor/reintegrar`, {
        monto: montoNum, forma_pago: forma, referencia: referencia.trim() || null, motivo: motivo.trim(),
      });
      toast.success(`Reintegro ${r.numero} registrado: ${formatCurrency(montoNum)} en ${forma}`);
      onDone();
      onClose();
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo registrar el reintegro' });
      setEnviando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !enviando) onClose(); }}>
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-md sm:rounded-2xl shadow-2xl flex flex-col" data-testid="reintegro-saldo-favor">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Banknote size={18} className="text-amber-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight">Devolver en dinero</p>
            <p className="text-xs text-gray-600 truncate">{clienteNombre} · tiene {formatCurrency(saldo)} a favor</p>
          </div>
          <button onClick={onClose} disabled={enviando} aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 disabled:opacity-40"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label htmlFor="rei-monto" className="block text-xs font-semibold text-gray-700 mb-1">Monto a devolver</label>
            <input id="rei-monto" value={monto} onChange={e => setMonto(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))} inputMode="decimal"
              className={cn('w-full h-11 border rounded-xl px-3 text-base focus:outline-none focus:ring-2',
                montoNum > saldo + 0.009 ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-amber-400')} />
            {montoNum > saldo + 0.009 && <p className="text-[11px] text-red-600 mt-1">No puede ser más que el saldo a favor ({formatCurrency(saldo)})</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Forma de entrega</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS_REINTEGRO.map(f => (
                <button key={f} type="button" onClick={() => setForma(f)}
                  className={cn('h-11 rounded-xl border-2 text-sm font-semibold',
                    forma === f ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-gray-200 text-gray-700')}>{f}</button>
              ))}
            </div>
          </div>
          {forma !== 'Efectivo' && (
            <input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={200}
              placeholder={forma === 'Transferencia' ? 'N° de transferencia / CBU (opcional)' : 'Referencia (opcional)'}
              className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
          )}
          <div>
            <label htmlFor="rei-motivo" className="block text-xs font-semibold text-gray-700 mb-1">Motivo</label>
            <input id="rei-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} placeholder="Por qué se devuelve el dinero"
              className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <p className="text-xs text-gray-600">Sale de caja. Queda en Actividad y se le avisa al administrador.</p>
        </div>
        <div className="shrink-0 border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={confirmar} disabled={invalido || enviando}
            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {enviando && <RefreshCw size={15} className="animate-spin" />} Devolver {montoNum > 0 ? formatCurrency(montoNum) : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
