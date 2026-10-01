import { useEffect, useState } from 'react';
import { Download, ShieldCheck, CheckCircle2, AlertTriangle, BookOpenCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toastApiError } from '@/lib/apiError';
import { fmt$, fechaCorta, numeroCbte } from './tipos';

interface Fila {
  id: string; fecha: string; tipo: string; punto_venta: number; numero: number; receptor: string; doc_tipo: number; doc_nro: string;
  netos: Record<string, number>; ivas: Record<string, number>; exento: number; total: number; modo: string;
}
interface Libro {
  desde: string; hasta: string; ambiente: string; filas: Fila[]; alicuotas: string[];
  totales: { netos: Record<string, number>; ivas: Record<string, number>; exento: number; total: number; cantidad: number };
}
interface Control { revisados: number; verificados: number; limitado: boolean; diferencias: { tipo: string; detalle: string; comprobante_id?: string }[] }

const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const rango = (mes: string) => {
  const [y, m] = mes.split('-').map(Number);
  return { desde: `${mes}-01`, hasta: `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` };
};
const pct = (a: string) => `${a.replace('.', ',')}%`;

// Libro IVA Ventas del mes (para el contador) y control cruzado contra ARCA.
export function TabLibroIva({ puedeEmitir, abrir }: { puedeEmitir: boolean; abrir: (id: string) => void }) {
  const [mes, setMes] = useState(mesActual());
  const [libro, setLibro] = useState<Libro | null>(null);
  const [control, setControl] = useState<Control | null>(null);
  const [controlando, setControlando] = useState(false);
  const { desde, hasta } = rango(mes);

  useEffect(() => {
    api.get<Libro>(`/facturacion/libro-iva?desde=${desde}&hasta=${hasta}`)
      .then(l => { setLibro(l); setControl(null); }).catch(e => toastApiError(e));
  }, [desde, hasta]);

  async function descargar() {
    try {
      const token = sessionStorage.getItem('aberturas_token');
      const res = await fetch(`/api/facturacion/libro-iva.csv?desde=${desde}&hasta=${hasta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement('a'), { href: url, download: `libro-iva-ventas_${mes}.csv` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { toastApiError(e); }
  }

  async function controlar() {
    setControlando(true);
    try {
      const r = await api.post<Control>('/facturacion/control', { desde, hasta });
      setControl(r);
      if (r.diferencias.length === 0) toast.success(`Todo coincide con ARCA (${r.verificados} comprobantes)`);
      else toast.warning(`${r.diferencias.length} diferencia${r.diferencias.length === 1 ? '' : 's'} con ARCA`);
    } catch (e) { toastApiError(e); } finally { setControlando(false); }
  }

  const btn = 'h-11 sm:h-10 px-3 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
          <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)}
            className="h-11 sm:h-10 px-3 border border-gray-300 rounded-lg text-base sm:text-sm bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap sm:ml-auto">
          <button onClick={descargar} disabled={!libro?.filas.length} className={btn}><Download size={15} /> Descargar para el contador (CSV)</button>
          {puedeEmitir && <button onClick={controlar} disabled={controlando || !libro?.filas.length} className={btn}>
            <ShieldCheck size={15} /> {controlando ? 'Controlando…' : 'Controlar con ARCA'}</button>}
        </div>
      </div>

      {control && (
        <div className={cn('rounded-xl border px-4 py-3 text-sm',
          control.diferencias.length ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900')}>
          {control.diferencias.length === 0
            ? <p className="flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /> Los {control.verificados} comprobantes del período coinciden con ARCA.</p>
            : <>
                <p className="flex gap-2 font-bold"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> Diferencias con ARCA ({control.diferencias.length}):</p>
                <ul className="list-disc pl-6 mt-1 space-y-0.5">
                  {control.diferencias.map((d, i) => (
                    <li key={i}>{d.comprobante_id ? <button onClick={() => abrir(d.comprobante_id!)} className="underline text-left">{d.detalle}</button> : d.detalle}</li>
                  ))}
                </ul>
              </>}
          {control.limitado && <p className="mt-1 text-xs">Se revisaron los primeros 400 comprobantes del período.</p>}
        </div>
      )}

      {!libro ? <p className="text-sm text-gray-600 py-6 text-center">Cargando…</p> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Resumen label="Comprobantes" valor={String(libro.totales.cantidad)} />
            {libro.alicuotas.map(a => <Resumen key={`n${a}`} label={`Neto ${pct(a)}`} valor={fmt$(libro.totales.netos[a] ?? 0)} />)}
            {libro.alicuotas.map(a => <Resumen key={`i${a}`} label={`IVA ${pct(a)}`} valor={fmt$(libro.totales.ivas[a] ?? 0)} />)}
            {libro.totales.exento !== 0 && <Resumen label="Exento" valor={fmt$(libro.totales.exento)} />}
            <Resumen label="Total facturado" valor={fmt$(libro.totales.total)} fuerte />
          </div>
          {libro.ambiente === 'homologacion' && libro.filas.length > 0 && (
            <p className="text-xs text-sky-800">Comprobantes del ambiente de <b>pruebas</b>: no tienen validez fiscal.</p>
          )}

          <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4">
            {libro.filas.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500"><BookOpenCheck size={18} /> No hay comprobantes en este período.</p>
            ) : (
              <>
                <table className="hidden md:table w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3">Fecha</th><th className="py-2 pr-3">Comprobante</th><th className="py-2 pr-3">Cliente</th>
                      <th className="py-2 pr-3 text-right">Neto</th><th className="py-2 pr-3 text-right">IVA</th><th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libro.filas.map(f => {
                      const neto = Object.values(f.netos).reduce((a, b) => a + b, 0) + f.exento;
                      const iva = Object.values(f.ivas).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={f.id} onClick={() => abrir(f.id)} className="border-b border-gray-100 hover:bg-fuchsia-50/50 cursor-pointer">
                          <td className="py-2 pr-3 whitespace-nowrap">{fechaCorta(f.fecha)}</td>
                          <td className="py-2 pr-3"><span className="font-semibold">{f.tipo}</span> <span className="font-mono text-xs text-gray-600">{numeroCbte(f.punto_venta, f.numero)}</span>{f.modo === 'CAEA' && <span className="ml-1 text-[10px] text-sky-700 font-bold">CAEA</span>}</td>
                          <td className="py-2 pr-3">{f.receptor}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmt$(neto)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmt$(iva)}</td>
                          <td className={cn('py-2 text-right tabular-nums font-semibold', f.total < 0 && 'text-amber-700')}>{fmt$(f.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <ul className="md:hidden divide-y divide-gray-200">
                  {libro.filas.map(f => (
                    <li key={f.id}>
                      <button onClick={() => abrir(f.id)} className="w-full text-left py-2.5 flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{f.receptor}</p>
                          <p className="text-xs text-gray-600">{f.tipo} {numeroCbte(f.punto_venta, f.numero)} · {fechaCorta(f.fecha)}</p>
                        </div>
                        <span className={cn('text-sm font-bold tabular-nums whitespace-nowrap', f.total < 0 && 'text-amber-700')}>{fmt$(f.total)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Resumen({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3', fuerte ? 'border-fuchsia-300 bg-fuchsia-50' : 'border-gray-300 bg-white')}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <p className={cn('tabular-nums', fuerte ? 'text-lg font-extrabold text-fuchsia-900' : 'text-base font-bold text-gray-900')}>{valor}</p>
    </div>
  );
}
