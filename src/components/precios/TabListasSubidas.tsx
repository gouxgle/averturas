import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, ChevronDown, Undo2, ExternalLink, FileSpreadsheet, History } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { fmt$, fmtPct } from './tipos';

interface ListaSubida {
  id: string | null; clave: string; proveedor_id: string; proveedor: string; origen: 'archivo' | 'planilla' | 'porcentaje';
  archivo: string | null; detalle: string | null; filas_leidas: number | null; actualizados: number; renovados: number;
  estado: 'aplicada' | 'revertida'; created_at: string; usuario: string | null; sospechosos: number; reconstruida: boolean; fecha?: string;
}
interface FilaSubida {
  producto_id: string; nombre: string; codigo: string | null; sku: string | null; accion: 'actualizar' | 'renovar';
  costo_antes: number | null; costo_despues: number | null; precio_antes: number | null; precio_despues: number | null;
  variacion_costo: number | null; variacion_precio: number | null; raro: string | null; vigente: boolean;
}

const ORIGEN: Record<ListaSubida['origen'], string> = { archivo: 'Archivo', planilla: 'Planilla del sistema', porcentaje: 'Porcentaje' };
const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

// Pestaña "Listas subidas": cada lista de precios de proveedor que se aplicó, con lo que valía cada producto
// antes y después, los cambios raros resaltados y la posibilidad de revertir (solo admin). Las subidas
// anteriores a este registro se reconstruyen desde el historial de precios.
export function TabListasSubidas({ onCambio }: { onCambio: () => void }) {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const [listas, setListas] = useState<ListaSubida[] | null>(null);
  const [error, setError] = useState(false);
  const [proveedor, setProveedor] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api.get<{ listas: ListaSubida[] }>('/listas-precios').then(r => { setListas(r.listas); setError(false); }).catch(() => setError(true));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const proveedores = useMemo(() => {
    const m = new Map<string, string>();
    (listas ?? []).forEach(l => m.set(l.proveedor_id, l.proveedor));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [listas]);
  const visibles = (listas ?? []).filter(l => !proveedor || l.proveedor_id === proveedor);

  if (error && !listas) return <p className="text-sm text-red-700">No se pudieron cargar las listas. Probá de nuevo en un momento.</p>;
  if (!listas) return <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3" data-testid="listas-subidas">
      <div className="rounded-2xl border border-gray-300 bg-white p-3 flex flex-wrap items-center gap-3">
        <p className="text-xs text-gray-700 flex-1 min-w-[16rem]">
          Cada vez que se aplica una lista de precios de un proveedor queda acá: qué valía cada producto <b>antes y después</b>,
          y cuáles son <b className="text-yellow-800">cambios raros</b>. Las subidas anteriores se reconstruyen del historial de precios.
        </p>
        <select value={proveedor} onChange={e => setProveedor(e.target.value)} aria-label="Filtrar por proveedor"
          className="h-10 px-2 rounded-lg border border-gray-300 bg-white text-sm w-full sm:w-auto">
          <option value="">Todos los proveedores</option>
          {proveedores.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-gray-300 bg-white py-10 text-center text-sm text-gray-600">Todavía no se subió ninguna lista de precios.</p>
      ) : visibles.map(l => (
        <TarjetaLista key={l.clave} lista={l} abierta={abierta === l.clave} esAdmin={esAdmin}
          onToggle={() => setAbierta(abierta === l.clave ? null : l.clave)}
          onRevertida={() => { cargar(); onCambio(); }} />
      ))}
    </div>
  );
}

function TarjetaLista({ lista: l, abierta, esAdmin, onToggle, onRevertida }: {
  lista: ListaSubida; abierta: boolean; esAdmin: boolean; onToggle: () => void; onRevertida: () => void;
}) {
  const [items, setItems] = useState<FilaSubida[] | null>(null);
  const [soloRaros, setSoloRaros] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);

  const fechaDia = l.reconstruida && l.fecha ? new Date(l.fecha).toISOString().slice(0, 10) : '';
  useEffect(() => {
    if (!abierta || items) return;
    const url = l.reconstruida
      ? `/listas-precios/reconstruida?${new URLSearchParams({ proveedor_id: l.proveedor_id, fecha: fechaDia, detalle: l.detalle ?? '' })}`
      : `/listas-precios/${l.id}`;
    api.get<{ items: FilaSubida[] }>(url).then(r => setItems(r.items)).catch(() => { setItems([]); toast.error('No se pudo cargar la lista'); });
  }, [abierta, items, l, fechaDia]);

  const raros = items?.filter(i => i.raro).length ?? l.sospechosos;
  const mostradas = (items ?? []).filter(i => !soloRaros || i.raro);
  const revertibles = (items ?? []).filter(i => i.accion === 'actualizar' && i.vigente).length;

  async function revertir() {
    setRevirtiendo(true);
    try {
      const r = await (l.reconstruida
        ? api.post<{ revertidos: number; omitidos: { nombre: string; motivo: string }[] }>('/listas-precios/reconstruida/revertir', { proveedor_id: l.proveedor_id, fecha: fechaDia, detalle: l.detalle })
        : api.post<{ revertidos: number; omitidos: { nombre: string; motivo: string }[] }>(`/listas-precios/${l.id}/revertir`, {}));
      toast.success(`Revertidos ${r.revertidos} productos${r.omitidos.length ? ` · ${r.omitidos.length} no se tocaron porque cambiaron después` : ''}`);
      setConfirmando(false);
      setItems(null);
      onRevertida();
    } catch (e) {
      toast.error('No se pudo revertir', { description: (e as Error).message });
    } finally {
      setRevirtiendo(false);
    }
  }

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden', raros ? 'border-yellow-400' : 'border-gray-300')}>
      <button type="button" onClick={onToggle} aria-expanded={abierta}
        className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-gray-50">
        <FileSpreadsheet size={18} className="text-orange-600 shrink-0" />
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-bold text-gray-900 truncate">{l.proveedor}</p>
          <p className="text-[11px] text-gray-600 truncate">{[fecha(l.created_at), l.archivo ?? l.detalle, l.usuario].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">{l.actualizados} actualizados</span>
          <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">{l.renovados} renovados</span>
          {raros > 0 && <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-900 inline-flex items-center gap-1"><AlertTriangle size={11} /> {raros} a revisar</span>}
          {l.estado === 'revertida' && <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Revertida</span>}
          {l.reconstruida && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700" title="Subida anterior al registro de listas: se arma desde el historial de precios">Del historial</span>}
          {!l.reconstruida && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{ORIGEN[l.origen]}</span>}
        </div>
        <ChevronDown size={16} className={cn('text-gray-500 transition-transform', abierta && 'rotate-180')} />
      </button>

      {abierta && (
        <div className="border-t border-gray-200">
          {!items ? <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin text-gray-400" /></div> : (
            <>
              <div className="px-4 py-2 bg-gray-50 flex flex-wrap items-center gap-3 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={soloRaros} onChange={e => setSoloRaros(e.target.checked)} /> Solo cambios raros ({items.filter(i => i.raro).length})
                </label>
                <Link to={`/proveedores/${l.proveedor_id}/precios`} className="inline-flex items-center gap-1 text-sky-700 font-semibold hover:underline">
                  Ver lista vigente del proveedor <ExternalLink size={12} />
                </Link>
                {esAdmin && l.estado === 'aplicada' && revertibles > 0 && !confirmando && (
                  <button type="button" onClick={() => setConfirmando(true)} data-testid="revertir-lista"
                    className="ml-auto h-9 px-3 rounded-lg border border-red-300 text-red-700 bg-white font-bold inline-flex items-center gap-1.5 hover:bg-red-50">
                    <Undo2 size={14} /> Revertir esta lista
                  </button>
                )}
              </div>
              {confirmando && (
                <div className="px-4 py-3 bg-red-50 border-y border-red-200 space-y-2">
                  <p className="text-sm text-red-900 font-semibold">¿Revertir la lista? Se devuelven costo y precio a lo que había antes en {revertibles} producto{revertibles !== 1 ? 's' : ''} que todavía tienen lo que puso la lista.</p>
                  <p className="text-xs text-red-800">Los que se modificaron después no se tocan. Queda registrado en el historial y en Actividad.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmando(false)} disabled={revirtiendo} className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold">Cancelar</button>
                    <button type="button" onClick={revertir} disabled={revirtiendo} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50">
                      {revirtiendo && <Loader2 size={14} className="animate-spin" />} Sí, revertir
                    </button>
                  </div>
                </div>
              )}
              {mostradas.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-600">{soloRaros ? 'No hay cambios raros en esta lista.' : 'Sin filas.'}</p>
              ) : (
                <ul className="divide-y divide-gray-100 max-h-[60dvh] overflow-y-auto">
                  {mostradas.map(i => (
                    <li key={i.producto_id} className={cn('px-4 py-2 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-x-3 gap-y-0.5 items-center', i.raro && 'bg-yellow-50')}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{i.nombre}</p>
                        <p className="text-[11px] text-gray-600 truncate">{[i.sku && `SKU ${i.sku}`, i.codigo, i.accion === 'renovar' && 'solo se renovó la validez', i.accion === 'actualizar' && !i.vigente && 'cambió después de la lista'].filter(Boolean).join(' · ')}</p>
                      </div>
                      {i.accion === 'actualizar' ? (
                        <>
                          <p className="text-xs tabular-nums"><span className="text-gray-600">costo</span> {fmt$(i.costo_antes ?? 0)} → <b>{fmt$(i.costo_despues ?? 0)}</b> <span className="text-gray-600">({fmtPct(i.variacion_costo)})</span></p>
                          <p className="text-xs tabular-nums"><span className="text-gray-600">venta</span> {fmt$(i.precio_antes ?? 0)} → <b className="text-orange-800">{fmt$(i.precio_despues ?? 0)}</b> <span className="text-gray-600">({fmtPct(i.variacion_precio)})</span></p>
                        </>
                      ) : <p className="text-xs text-gray-600 lg:col-span-2">Sin cambios de costo ni de precio</p>}
                      {i.raro && <p className="col-span-full text-[11px] font-semibold text-yellow-900"><AlertTriangle size={11} className="inline mr-1" />{i.raro}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {l.reconstruida && (
                <p className="px-4 py-2 text-[11px] text-gray-600 border-t border-gray-100"><History size={11} className="inline mr-1" />
                  Subida anterior al registro de listas: se muestra desde el historial de precios (sin el valor leído del archivo).
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
