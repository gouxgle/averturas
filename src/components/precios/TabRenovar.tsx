import { useMemo, useState } from 'react';
import { RefreshCw, Loader2, ListChecks, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type ProductoRevision, type Revision, fmt$, fmtPct, fmtFecha, colorDias } from './tipos';
import { Filtros, CeldaCosto, Motivos, Casilla } from './comunes';
import { aplicarFiltro, FILTRO_VACIO, type Filtro } from './filtros';

// Pestaña 1: lo que el análisis dice que NO varió (ni costo, ni dólar, ni recargo) y conviene
// solo renovar la validez. Vienen marcados; se renueva la fecha sin tocar el precio.
export function TabRenovar({ revision, soloLectura, onCambio, onElegirAMano }: {
  revision: Revision; soloLectura: boolean; onCambio: () => void; onElegirAMano: () => void;
}) {
  const sugeridos = useMemo(() => revision.productos.filter(p => p.analisis.estado === 'renovar')
    .sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre)), [revision]);
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const visibles = aplicarFiltro(sugeridos, filtro);
  const elegidos = visibles.filter(p => !desmarcados.has(p.id));
  const todos = visibles.length > 0 && elegidos.length === visibles.length;

  const toggle = (id: string) => setDesmarcados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleTodos = () => setDesmarcados(prev => {
    const n = new Set(prev);
    if (todos) visibles.forEach(p => n.add(p.id)); else visibles.forEach(p => n.delete(p.id));
    return n;
  });

  async function renovar() {
    if (!elegidos.length || guardando) return;
    setGuardando(true);
    try {
      const r = await api.patch<{ actualizados: number }>('/productos/renovar-validez-precios', { producto_ids: elegidos.map(p => p.id) });
      toast.success(`Validez renovada en ${r.actualizados} producto${r.actualizados !== 1 ? 's' : ''}`);
      setDesmarcados(new Set());
      onCambio();
    } catch (e) {
      toast.error('No se pudo renovar', { description: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-900">
        <b>{sugeridos.length} producto{sugeridos.length !== 1 ? 's' : ''} sin variación</b>: ni la lista del proveedor, ni la
        última compra, ni el dólar se movieron más de {revision.config.umbral_pct} % desde su última actualización, y el
        recargo está bien. Conviene <b>renovar la validez</b> sin cambiar el precio.
      </div>

      <Filtros productos={sugeridos} filtro={filtro} onChange={setFiltro} />

      <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <button type="button" onClick={toggleTodos} disabled={!visibles.length} className="inline-flex items-center gap-2 text-xs font-semibold text-sky-700 disabled:opacity-40">
            <Casilla checked={todos} /> {todos ? 'Desmarcar todos' : 'Marcar todos'} ({visibles.length})
          </button>
          <button type="button" onClick={onElegirAMano} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-sky-700">
            <ListChecks size={14} /> Elegir a mano o por familia
          </button>
        </div>
        {visibles.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-600">
            <CheckCheck size={26} className="mx-auto text-emerald-500 mb-1" />
            {sugeridos.length ? 'Ningún producto coincide con los filtros.' : 'No hay productos para renovar: revisá la pestaña "Actualizar precios".'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[60dvh] overflow-y-auto">
            {visibles.map(p => <FilaRenovar key={p.id} p={p} marcado={!desmarcados.has(p.id)} onToggle={() => toggle(p.id)} cfg={revision.config} />)}
          </div>
        )}
      </div>

      {!soloLectura && (
        <div className="sticky bottom-2 flex justify-end">
          <button type="button" onClick={renovar} disabled={!elegidos.length || guardando}
            className="h-11 px-5 rounded-xl bg-sky-600 text-white text-sm font-bold shadow-lg hover:bg-sky-700 disabled:opacity-50 inline-flex items-center gap-2">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Renovar validez ({elegidos.length})
          </button>
        </div>
      )}
    </div>
  );
}

function FilaRenovar({ p, marcado, onToggle, cfg }: { p: ProductoRevision; marcado: boolean; onToggle: () => void; cfg: Revision['config'] }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={marcado}
      className={cn('w-full text-left px-4 py-2.5 grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,2fr)_8rem_10rem_minmax(0,1.3fr)] gap-x-3 gap-y-1 items-center hover:bg-gray-50',
        marcado && 'bg-sky-50/40')}>
      <Casilla checked={marcado} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{p.nombre}</p>
        <p className="text-[11px] text-gray-600 truncate">{[p.codigo, p.familia ?? 'Sin familia', p.linea ?? p.sistema, p.proveedor].filter(Boolean).join(' · ')}</p>
      </div>
      <CeldaCosto p={p} />
      <div className="col-start-2 md:col-start-auto text-left md:text-right leading-tight">
        <p className={cn('text-xs font-bold', colorDias(p.dias, cfg))}>Renovado {fmtFecha(p.precio_actualizado_at)}</p>
        <p className="text-[11px] text-gray-600">hace {p.dias} día{p.dias !== 1 ? 's' : ''}</p>
        <p className="text-[11px] text-gray-600 tabular-nums">venta {fmt$(p.precio)}</p>
      </div>
      <div className="col-start-2 col-span-2 md:col-span-1 md:col-start-auto min-w-0">
        <Motivos motivos={p.analisis.motivos}
          vacio={`Sin cambios de costo ni de dólar${p.analisis.var_dolar !== null ? ` (dólar ${fmtPct(p.analisis.var_dolar)})` : ''}`} />
      </div>
    </button>
  );
}
