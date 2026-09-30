import { useEffect, useState } from 'react';
import { Search, FileX } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toastApiError } from '@/lib/apiError';
import {
  CBTE_NOMBRE, ESTADO_CBTE, numeroCbte, fmt$, fechaCorta, documentoTexto, type ComprobanteLista, type EstadoCbte,
} from './tipos';

const inp = 'h-11 sm:h-10 px-3 border border-gray-300 rounded-lg text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-400';

export function LetraBadge({ clase, nc }: { clase: 'A' | 'B'; nc?: boolean }) {
  return (
    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-md border-2 text-sm font-black shrink-0',
      nc ? 'border-amber-500 text-amber-700 bg-amber-50' : 'border-gray-800 text-gray-900 bg-white')}>
      {clase}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoCbte }) {
  const e = ESTADO_CBTE[estado] ?? { label: estado, cls: 'bg-gray-500 text-white' };
  return <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap', e.cls)}>{e.label}</span>;
}

export function TabComprobantes({ abrir, refresh }: { abrir: (id: string) => void; refresh: number }) {
  const [lista, setLista] = useState<ComprobanteLista[] | null>(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<'' | EstadoCbte>('');

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (estado) p.set('estado', estado);
      api.get<ComprobanteLista[]>(`/facturacion/comprobantes?${p}`).then(setLista).catch(e => toastApiError(e));
    }, 250);
    return () => clearTimeout(t);
  }, [q, estado, refresh]);

  return (
    <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por cliente, documento o número…"
            className={cn(inp, 'w-full pl-9')} />
        </div>
        <select value={estado} onChange={e => setEstado(e.target.value as '' | EstadoCbte)} className={cn(inp, 'sm:w-52')}>
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO_CBTE) as EstadoCbte[]).map(k => <option key={k} value={k}>{ESTADO_CBTE[k].label}</option>)}
        </select>
      </div>

      {!lista ? (
        <p className="text-sm text-gray-600 py-6 text-center">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-2 text-gray-500">
          <FileX size={28} />
          <p className="text-sm">{q || estado ? 'No hay comprobantes que coincidan.' : 'Todavía no hay comprobantes.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3 font-bold">Fecha</th>
                <th className="py-2 pr-3 font-bold">Comprobante</th>
                <th className="py-2 pr-3 font-bold">Cliente</th>
                <th className="py-2 pr-3 font-bold text-right">Total</th>
                <th className="py-2 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} onClick={() => abrir(c.id)} className="border-b border-gray-100 hover:bg-fuchsia-50/50 cursor-pointer">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-gray-700">{fechaCorta(c.fecha)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <LetraBadge clase={c.clase} nc={c.tipo_doc === 'nota_credito'} />
                      <div>
                        <p className="font-semibold text-gray-900">{CBTE_NOMBRE[c.cbte_tipo]}</p>
                        <p className="font-mono text-xs text-gray-600">{numeroCbte(c.punto_venta, c.numero)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <p className="text-gray-900">{c.receptor_nombre}</p>
                    <p className="text-xs text-gray-500">{documentoTexto(c.receptor_doc_tipo, c.receptor_doc_nro)}</p>
                  </td>
                  <td className={cn('py-2.5 pr-3 text-right font-semibold tabular-nums whitespace-nowrap',
                    c.tipo_doc === 'nota_credito' ? 'text-amber-700' : 'text-gray-900')}>
                    {c.tipo_doc === 'nota_credito' ? '−' : ''}{fmt$(c.imp_total)}
                  </td>
                  <td className="py-2.5"><EstadoBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile */}
          <ul className="md:hidden divide-y divide-gray-200">
            {lista.map(c => (
              <li key={c.id}>
                <button onClick={() => abrir(c.id)} className="w-full text-left py-3 flex gap-3 items-start">
                  <LetraBadge clase={c.clase} nc={c.tipo_doc === 'nota_credito'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.receptor_nombre}</p>
                      <p className={cn('text-sm font-bold tabular-nums whitespace-nowrap', c.tipo_doc === 'nota_credito' ? 'text-amber-700' : 'text-gray-900')}>
                        {c.tipo_doc === 'nota_credito' ? '−' : ''}{fmt$(c.imp_total)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-600">{CBTE_NOMBRE[c.cbte_tipo]} · <span className="font-mono">{numeroCbte(c.punto_venta, c.numero)}</span></p>
                    <div className="flex items-center gap-2 mt-1">
                      <EstadoBadge estado={c.estado} />
                      <span className="text-xs text-gray-500">{fechaCorta(c.fecha)}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
