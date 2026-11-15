import { useState } from 'react';
import { PackageCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';

/** Stock reservado por una venta señada, con la opción de liberarlo si no se va a entregar. */
export function PanelReserva({ operacionId, reservas, onLiberada }: {
  operacionId: string;
  reservas: { producto_id: string; nombre: string; codigo: string | null; cantidad: number }[];
  onLiberada: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const total = reservas.reduce((s, r) => s + r.cantidad, 0);

  async function liberar() {
    setLiberando(true);
    try {
      await api.post(`/operaciones/${operacionId}/liberar-reserva`, {});
      toast.success('Reserva liberada: ese stock ya se puede vender');
      setConfirmar(false);
      onLiberada();
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo liberar la reserva' });
    } finally {
      setLiberando(false);
    }
  }

  return (
    <div data-testid="panel-reserva" className="mx-5 my-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <PackageCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Stock reservado: {total} unidad{total === 1 ? '' : 'es'}
          </p>
          <p className="text-xs text-amber-700">
            La venta está señada: este stock no se puede vender a otro cliente hasta que se entregue.
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {reservas.map(r => (
              <li key={r.producto_id} className="text-xs text-amber-900">
                {r.cantidad} × {r.nombre}{r.codigo ? <span className="text-amber-700"> ({r.codigo})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {!confirmar ? (
        <div className="flex justify-end mt-2">
          <button onClick={() => setConfirmar(true)}
            className="h-9 px-3 text-xs font-semibold rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-100">
            Liberar reserva
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-amber-800">
            ¿Liberar? El stock vuelve a quedar disponible para vender. Si después se arma el remito o entra otro pago,
            se vuelve a reservar lo que haya.
          </p>
          <div className="flex gap-2">
            <button onClick={liberar} disabled={liberando}
              className="flex-1 h-10 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
              {liberando ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Sí, liberar'}
            </button>
            <button onClick={() => setConfirmar(false)}
              className="flex-1 h-10 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-600">
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
