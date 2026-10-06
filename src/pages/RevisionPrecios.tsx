import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Scale, RefreshCw, TrendingUp, FileSpreadsheet, Calculator, SlidersHorizontal, Loader2, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import { HelpButton } from '@/components/HelpButton';
import { ModalRenovarValidezPrecios } from '@/components/productos/ModalRenovarValidezPrecios';
import type { Producto } from '@/types';
import { type Revision, fmt$, fmtPct } from '@/components/precios/tipos';
import { TabRenovar } from '@/components/precios/TabRenovar';
import { TabActualizar } from '@/components/precios/TabActualizar';
import { TabListaProveedor } from '@/components/precios/TabListaProveedor';
import { TabFormula } from '@/components/precios/TabFormula';

type Tab = 'renovar' | 'actualizar' | 'formula' | 'proveedor';

// Revisión integral de precios: analiza cada producto (costo de lista y de última compra,
// recargo, dólar blue, inflación, ventas) y sugiere qué renovar y qué actualizar; la
// actualización y la lista de cada proveedor tienen su propia pestaña.
export default function RevisionPrecios() {
  const { user } = useAuth();
  const soloLectura = user?.rol === 'consulta';
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'renovar';
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [aMano, setAMano] = useState<Producto[] | null>(null);
  const [parametros, setParametros] = useState(false);

  useEffect(() => {
    api.get<Revision>('/productos/revision-precios').then(r => { setRevision(r); setError(false); }).catch(() => setError(true));
  }, [refresh]);
  const recargar = useCallback(() => setRefresh(r => r + 1), []);
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };

  async function abrirAMano() {
    try { setAMano(await api.get<Producto[]>('/productos')); } catch { toast.error('No se pudieron cargar los productos'); }
  }

  const cuenta = (e: string) => revision?.productos.filter(p => p.analisis.estado === e).length ?? 0;
  const recargos = revision?.productos.map(p => p.analisis.recargo_actual).filter((x): x is number => x !== null) ?? [];
  const recargoProm = recargos.length ? recargos.reduce((a, b) => a + b, 0) / recargos.length : null;
  const mesIpc = revision?.ipc.ultimo ? new Date(`${revision.ipc.ultimo.mes.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { month: 'short' }) : '';

  const TABS: { v: Tab; l: string; icon: typeof RefreshCw; n?: number }[] = [
    { v: 'renovar', l: 'Renovar validez', icon: RefreshCw, n: cuenta('renovar') },
    { v: 'actualizar', l: 'Actualizar precios', icon: TrendingUp, n: cuenta('actualizar') },
    { v: 'formula', l: 'Por fórmula', icon: Calculator, n: revision?.productos.filter(p => p.analisis.desvio_formula_pct !== null && !p.analisis.posible_error_carga && p.analisis.desvio_formula_pct <= -revision.config.umbral_pct).length },
    { v: 'proveedor', l: 'Lista del proveedor', icon: FileSpreadsheet },
  ];

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section="productos">
      <SectionHero
        section="productos"
        icon={Scale}
        title="Revisión integral de precios"
        sub="Qué renovar, qué actualizar y cuánto: costo del proveedor, última compra, dólar blue e inflación"
        actions={<>
          <HelpButton topic="precios" />
          <Link to="/productos" className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 text-sm font-semibold px-4 h-10 rounded-xl hover:bg-gray-50 shadow-sm">
            <ArrowLeft size={15} /> Productos
          </Link>
          {user?.rol === 'admin' && revision && (
            <button onClick={() => setParametros(true)} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 text-sm font-semibold px-4 h-10 rounded-xl hover:bg-gray-50 shadow-sm">
              <SlidersHorizontal size={15} /> Parámetros
            </button>
          )}
        </>}
      />

      {revision && (
        <CompactStatsBar items={[
          { value: fmt$(revision.dolar.hoy), label: `dólar blue${revision.dolar.var_30d !== null ? ` (${fmtPct(revision.dolar.var_30d)} 30 d)` : ''}`, color: '#86efac' },
          { value: revision.ipc.ultimo ? fmtPct(revision.ipc.ultimo.variacion, false) : '—', label: `inflación ${mesIpc}${revision.ipc.ultimos_3 !== null ? ` (3 m: ${fmtPct(revision.ipc.ultimos_3, false)})` : ''}`, color: '#ffffff' },
          { value: cuenta('actualizar'), label: 'para actualizar', color: cuenta('actualizar') ? '#fdba74' : '#ffffff' },
          { value: cuenta('renovar'), label: 'para renovar', color: '#7dd3fc' },
          { value: cuenta('al_dia'), label: 'al día', color: '#ffffff' },
          ...(cuenta('sin_datos') ? [{ value: cuenta('sin_datos'), label: 'sin costo', color: '#fca5a5' }] : []),
          { value: fmtPct(recargoProm, false), label: 'recargo prom.', color: '#ffffff' },
        ]} />
      )}

      <div className="flex gap-1 flex-wrap">
        {TABS.map(x => (
          <button key={x.v} onClick={() => setTab(x.v)}
            className={cn('flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              tab === x.v ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-gray-600 border-gray-200 hover:border-sky-400 hover:text-sky-700')}>
            <x.icon size={14} /> {x.l}
            {x.n !== undefined && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', tab === x.v ? 'bg-white/20' : 'bg-sky-100 text-sky-800')}>{x.n}</span>}
          </button>
        ))}
      </div>

      {error && !revision && <p className="text-sm text-red-700">No se pudo cargar el análisis. Probá de nuevo en un momento.</p>}
      {!revision && !error && <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}
      {revision && tab === 'renovar' && <TabRenovar revision={revision} soloLectura={soloLectura} onCambio={recargar} onElegirAMano={abrirAMano} />}
      {revision && tab === 'actualizar' && <TabActualizar revision={revision} soloLectura={soloLectura} onCambio={recargar} />}
      {revision && tab === 'formula' && <TabFormula revision={revision} soloLectura={soloLectura} onCambio={recargar} />}
      {revision && tab === 'proveedor' && <TabListaProveedor revision={revision} soloLectura={soloLectura} proveedorInicial={params.get('proveedor')} onCambio={recargar} />}

      {aMano && <ModalRenovarValidezPrecios productos={aMano} onClose={() => setAMano(null)} onRenovado={recargar} />}
      {parametros && revision && <ModalParametros config={revision.config} onClose={() => setParametros(false)} onGuardado={recargar} />}
    </div>
  );
}

function ModalParametros({ config, onClose, onGuardado }: { config: Revision['config']; onClose: () => void; onGuardado: () => void }) {
  const [c, setC] = useState(config);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    try {
      await api.put('/productos/revision-precios/config', c);
      toast.success('Parámetros guardados');
      onGuardado();
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar', { description: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }
  const campo = (k: keyof typeof c, l: string, ayuda: string, step = 1) => (
    <label className="block text-sm font-semibold text-gray-800">{l}
      <input type="number" step={step} value={c[k]} onChange={e => setC({ ...c, [k]: Number(e.target.value) })}
        className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-300 font-normal" />
      <span className="block text-xs font-normal text-gray-600 mt-0.5">{ayuda}</span>
    </label>
  );
  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Parámetros de la revisión" className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center"><h2 className="font-bold text-gray-900">Parámetros de la revisión</h2>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X size={18} /></button></div>
        <div className="p-5 space-y-4">
          {campo('umbral_pct', 'Variación mínima para sugerir actualizar (%)', 'Por debajo de esto se considera "sin variación" y se sugiere renovar la validez.', 0.5)}
          {campo('dias_al_dia', 'Días "al día" (verde)', 'Precios renovados hace estos días o menos no se proponen.')}
          {campo('dias_vencido', 'Días "vencido" (rojo)', 'Desde estos días el precio se marca en rojo.')}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="h-10 px-5 rounded-lg bg-sky-600 text-white text-sm font-bold disabled:opacity-50">Guardar</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
