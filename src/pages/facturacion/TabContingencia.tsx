import { useEffect, useState } from 'react';
import { ShieldAlert, KeyRound, Upload, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toastApiError } from '@/lib/apiError';
import { CBTE_NOMBRE, numeroCbte, fmt$, fechaCorta } from './tipos';

interface Caea {
  id: string; caea: string; periodo: number; orden: number; fch_vig_desde: string; fch_vig_hasta: string;
  fch_tope_inf: string; estado: 'vigente' | 'cerrado' | 'informado'; usados: string; sin_informar: string;
  informes: { punto_venta: number; sin_movimiento: boolean; informado_at: string | null; error: string | null }[];
}
interface Pendiente {
  id: string; cbte_tipo: number; punto_venta: number; numero: string; fecha: string; receptor_nombre: string;
  imp_total: string; contingencia_causa: string; errores: { code: string; msg: string }[] | null;
}
interface Estado { vigente: Caea | null; caeas: Caea[]; pendientes: Pendiente[]; alertas: string[]; pv_caea: boolean }

const quincena = (c: Caea) => `${c.orden === 1 ? '1ª' : '2ª'} quincena de ${String(c.periodo).slice(4)}/${String(c.periodo).slice(0, 4)}`;
const ESTADO_CAEA: Record<Caea['estado'], { l: string; c: string }> = {
  vigente: { l: 'Vigente / en curso', c: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cerrado: { l: 'Falta informar', c: 'bg-amber-50 text-amber-800 border-amber-200' },
  informado: { l: 'Informado', c: 'bg-gray-50 text-gray-700 border-gray-200' },
};

// Contingencia con CAEA (RG 5852): solo se usa si ARCA no da CAE. El CAEA de cada quincena
// lo pide el sistema solo; acá se ve su estado, lo emitido pendiente de informar y alertas.
export function TabContingencia({ puedeEmitir, abrir, refresh, onChanged }: {
  puedeEmitir: boolean; abrir: (id: string) => void; refresh: number; onChanged: () => void;
}) {
  const [e, setE] = useState<Estado | null>(null);
  const [trabajando, setTrabajando] = useState<null | 'caea' | 'informar'>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    api.get<Estado>('/facturacion/contingencia').then(setE).catch(x => toastApiError(x));
  }, [refresh, recarga]);

  async function pedirCaea() {
    setTrabajando('caea');
    try {
      const r = await api.post<{ actual: { caea: string } }>('/facturacion/contingencia/caea', {});
      toast.success(`CAEA de la quincena: ${r.actual.caea}`);
      setRecarga(x => x + 1);
    } catch (x) { toastApiError(x); } finally { setTrabajando(null); }
  }
  async function informar() {
    setTrabajando('informar');
    try {
      const r = await api.post<{ informados: number; pendientes: number; errores: string[] }>('/facturacion/contingencia/informar', {});
      if (r.pendientes === 0) toast.success(`Informados a ARCA: ${r.informados}`);
      else toast.error(`Quedan ${r.pendientes} sin informar`, { description: r.errores.join('\n'), duration: 12000 });
      setRecarga(x => x + 1); onChanged();
    } catch (x) { toastApiError(x); } finally { setTrabajando(null); }
  }

  if (!e) return <p className="text-sm text-gray-600 py-6 text-center">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 flex gap-3">
        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
        <p>El <b>CAEA</b> es el código para seguir facturando si ARCA no responde. El sistema lo pide solo por quincena y
          lo informa cuando ARCA vuelve. <b>Solo se usa en contingencia</b> (RG 5852): con ARCA andando se factura normal.</p>
      </div>
      {!e.pv_caea && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Falta configurar un <b>punto de venta de contingencia (CAEA)</b> en Configuración &gt; Facturación con ARCA.
        </p>
      )}
      {e.alertas.map((a, i) => (
        <p key={i} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {a}
        </p>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800"><KeyRound size={16} className="text-sky-700" /> CAEA de la quincena</h2>
          {e.vigente ? (
            <div className="text-sm text-gray-700 space-y-0.5">
              <p className="font-mono text-lg font-bold text-gray-900">{e.vigente.caea}</p>
              <p>{quincena(e.vigente)}: del {fechaCorta(e.vigente.fch_vig_desde)} al {fechaCorta(e.vigente.fch_vig_hasta)}</p>
              <p>Informar a más tardar el <b>{fechaCorta(e.vigente.fch_tope_inf)}</b> · usado en {e.vigente.usados} comprobante{e.vigente.usados === '1' ? '' : 's'}</p>
            </div>
          ) : <p className="text-sm text-gray-600">Todavía no hay CAEA para esta quincena.</p>}
          {puedeEmitir && e.pv_caea && (
            <button onClick={pedirCaea} disabled={!!trabajando} className="h-11 sm:h-10 px-3 inline-flex items-center gap-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw size={15} className={trabajando === 'caea' ? 'animate-spin' : ''} /> Pedir / actualizar CAEA ahora
            </button>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800"><Upload size={16} className="text-sky-700" /> Emitidos con CAEA sin informar ({e.pendientes.length})</h2>
          {e.pendientes.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-gray-600"><CheckCircle2 size={16} className="text-emerald-600" /> No hay nada pendiente de informar.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {e.pendientes.map(p => (
                  <li key={p.id}>
                    <button onClick={() => abrir(p.id)} className="w-full text-left py-2 flex gap-3 items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.receptor_nombre}</p>
                        <p className="text-xs text-gray-600">{CBTE_NOMBRE[p.cbte_tipo]} {numeroCbte(p.punto_venta, p.numero)} · {fechaCorta(p.fecha)}</p>
                        {p.errores?.length ? <p className="text-xs text-red-700">{p.errores.map(x => x.msg).join(' · ')}</p> : null}
                      </div>
                      <span className="text-sm font-bold tabular-nums">{fmt$(p.imp_total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {puedeEmitir && (
                <button onClick={informar} disabled={!!trabajando} className="h-11 sm:h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:opacity-50">
                  <Upload size={15} /> {trabajando === 'informar' ? 'Informando…' : 'Informar a ARCA ahora'}
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {e.caeas.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-2">Historial de CAEA</h2>
          <ul className="divide-y divide-gray-100">
            {e.caeas.map(c => (
              <li key={c.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                <span className="font-mono font-semibold text-gray-900">{c.caea}</span>
                <span className="text-gray-600 flex-1">{quincena(c)} · usado {c.usados} · tope {fechaCorta(c.fch_tope_inf)}
                  {c.informes.some(i => i.sin_movimiento && i.informado_at) && ' · sin movimiento informado'}</span>
                <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md border self-start', ESTADO_CAEA[c.estado].c)}>{ESTADO_CAEA[c.estado].l}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
