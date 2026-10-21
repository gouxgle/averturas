import { useState } from 'react';
import { ChevronDown, FileSpreadsheet, Loader2, History } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { HistorialPrecios } from '@/components/precios/comunes';
import { fmt$, fmtPct } from '@/components/precios/tipos';

interface DatosListas {
  lista_vigente: { sku: string; descripcion: string; precio: number; updated_at: string } | null;
  ultimas_subidas: {
    id: string; origen: string; archivo: string | null; detalle: string | null; estado: string; created_at: string; sku: string | null; accion: string;
    precio_leido: number | null; costo_antes: number | null; costo_despues: number | null; precio_antes: number | null; precio_despues: number | null;
  }[];
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

// "Precios y listas" de un producto: el precio de lista vigente del proveedor, las últimas subidas que lo
// tocaron (con antes/después) y el historial completo de precios. Se carga recién al abrir la sección.
export function PreciosYListas({ productoId, abierto = false }: { productoId: string; abierto?: boolean }) {
  const [open, setOpen] = useState(abierto);
  const [datos, setDatos] = useState<DatosListas | null>(null);
  const [cargando, setCargando] = useState(false);

  function alternar() {
    const nuevo = !open;
    setOpen(nuevo);
    if (nuevo && !datos && !cargando) {
      setCargando(true);
      api.get<DatosListas>(`/listas-precios/producto/${productoId}`)
        .then(setDatos).catch(() => setDatos({ lista_vigente: null, ultimas_subidas: [] })).finally(() => setCargando(false));
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden" data-testid="precios-y-listas">
      <button type="button" onClick={alternar} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-gray-50 hover:bg-gray-100">
        <FileSpreadsheet size={14} className="text-orange-600" />
        <span className="text-xs font-bold text-gray-800 flex-1">Precios y listas</span>
        <span className="text-[11px] text-gray-600 hidden sm:inline">lista del proveedor e historial</span>
        <ChevronDown size={14} className={cn('text-gray-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {cargando && !datos ? <div className="py-2 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div> : datos && (
            <>
              <div className="text-xs">
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Lista vigente del proveedor</p>
                {datos.lista_vigente ? (
                  <p className="text-gray-800">
                    <span className="font-mono">{datos.lista_vigente.sku}</span> · <b className="tabular-nums">{fmt$(datos.lista_vigente.precio)}</b>
                    <span className="text-gray-600"> · actualizada el {fechaCorta(datos.lista_vigente.updated_at)}</span>
                  </p>
                ) : <p className="text-gray-600">Este producto no está enlazado a ninguna lista del proveedor.</p>}
              </div>
              {datos.ultimas_subidas.length > 0 && (
                <div className="text-xs">
                  <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Últimas listas que lo tocaron</p>
                  <ul className="space-y-1">
                    {datos.ultimas_subidas.map(u => (
                      <li key={`${u.id}-${u.sku}`} className="rounded-lg bg-gray-50 px-2 py-1.5">
                        <p className="text-gray-800 font-semibold">{fechaCorta(u.created_at)} · {u.archivo ?? u.detalle ?? 'Lista'}{u.estado === 'revertida' && <span className="ml-1.5 text-gray-600 font-normal">(revertida)</span>}</p>
                        {u.accion === 'actualizar' ? (
                          <p className="tabular-nums text-gray-700">
                            valor leído {u.precio_leido !== null ? <b>{fmt$(u.precio_leido)}</b> : '—'} · costo {fmt$(u.costo_antes ?? 0)} → <b>{fmt$(u.costo_despues ?? 0)}</b>
                            {u.costo_antes ? <span className="text-gray-600"> ({fmtPct(((u.costo_despues ?? 0) / u.costo_antes - 1) * 100)})</span> : null}
                            {' '}· venta {fmt$(u.precio_antes ?? 0)} → <b>{fmt$(u.precio_despues ?? 0)}</b>
                          </p>
                        ) : <p className="text-gray-600">Solo se renovó la validez</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1 flex items-center gap-1"><History size={11} /> Historial de precios</p>
                <HistorialPrecios productoId={productoId} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
