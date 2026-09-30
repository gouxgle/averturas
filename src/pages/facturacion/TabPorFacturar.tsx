import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { fmt$, fechaCorta } from './tipos';

interface ReciboPendiente {
  id: string; numero: string; fecha: string; monto_total: number; facturado: number; saldo: number;
  cliente_nombre: string; operacion_numero: string | null;
}
interface OperacionPendiente {
  id: string; numero: string; estado: string; cliente_nombre: string; total: number; facturado: number;
  cobrado: number; saldo: number;
}

const ESTADO_OP: Record<string, string> = {
  aprobado: 'Aprobado', en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado', entregado: 'Entregado',
};

// Lo que todavía no está facturado: cada recibo (cobro, incluidas señas) y cada presupuesto
// aprobado con saldo sin facturar. Se factura caso por caso desde acá.
export function TabPorFacturar({ puedeEmitir, refresh }: { puedeEmitir: boolean; refresh: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ recibos: ReciboPendiente[]; operaciones: OperacionPendiente[] } | null>(null);

  useEffect(() => {
    api.get<{ recibos: ReciboPendiente[]; operaciones: OperacionPendiente[] }>('/facturacion/por-facturar')
      .then(setData).catch(e => toastApiError(e));
  }, [refresh]);

  if (!data) return <p className="text-sm text-gray-600 py-6 text-center">Cargando…</p>;

  const boton = (to: string) => puedeEmitir && (
    <button onClick={() => navigate(to)}
      className="shrink-0 inline-flex items-center gap-1.5 h-11 sm:h-9 px-3 rounded-lg bg-fuchsia-700 text-white text-xs font-semibold hover:bg-fuchsia-800">
      Facturar <ArrowRight size={13} />
    </button>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-1">
          <Receipt size={16} className="text-emerald-700" /> Cobros sin facturar
          <span className="text-xs font-semibold text-gray-500">({data.recibos.length})</span>
        </h2>
        <p className="text-xs text-gray-600 mb-3">Cada recibo emitido (seña, pago parcial o total) que todavía no tiene factura.</p>
        {data.recibos.length === 0 ? <Vacio texto="Todos los cobros están facturados." /> : (
          <ul className="divide-y divide-gray-200">
            {data.recibos.map(r => (
              <li key={r.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.cliente_nombre}</p>
                  <p className="text-xs text-gray-600">
                    <span className="font-mono">{r.numero}</span> · {fechaCorta(r.fecha)}
                    {r.operacion_numero && <> · {r.operacion_numero.replace(/^OP-/, 'PRO-')}</>}
                  </p>
                  {r.facturado > 0 && <p className="text-[11px] text-amber-700">Ya facturado {fmt$(r.facturado)} de {fmt$(r.monto_total)}</p>}
                </div>
                <p className="text-sm font-bold tabular-nums text-gray-900 whitespace-nowrap">{fmt$(r.saldo)}</p>
                {boton(`/facturacion/nueva?recibo_id=${r.id}`)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-1">
          <FileText size={16} className="text-violet-700" /> Presupuestos aprobados sin facturar
          <span className="text-xs font-semibold text-gray-500">({data.operaciones.length})</span>
        </h2>
        <p className="text-xs text-gray-600 mb-3">Para facturar la venta completa (por ejemplo, al entregar) en lugar de cada cobro.</p>
        {data.operaciones.length === 0 ? <Vacio texto="No hay presupuestos con saldo sin facturar." /> : (
          <ul className="divide-y divide-gray-200">
            {data.operaciones.map(o => (
              <li key={o.id} className="py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{o.cliente_nombre}</p>
                  <p className="text-xs text-gray-600">
                    <span className="font-mono">{o.numero}</span> · {ESTADO_OP[o.estado] ?? o.estado} · cobrado {fmt$(o.cobrado)}
                  </p>
                  {o.facturado > 0 && <p className="text-[11px] text-amber-700">Ya facturado {fmt$(o.facturado)} de {fmt$(o.total)}</p>}
                </div>
                <p className="text-sm font-bold tabular-nums text-gray-900 whitespace-nowrap">{fmt$(o.saldo)}</p>
                {boton(`/facturacion/nueva?operacion_id=${o.id}`)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="flex items-center gap-2 py-6 justify-center text-sm text-gray-500"><CheckCircle2 size={16} className="text-emerald-600" /> {texto}</p>;
}
