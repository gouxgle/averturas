import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  cascadaActiva, opcionesFamilias, opcionesMateriales, opcionesMedidas, opcionesTipologias,
  type CascadaFiltro,
} from '@/lib/catalogoCascada';
import type { Producto } from '@/types';

// Búsqueda en cascada: Material → Familia → Tipología → Medida estándar. Cada paso
// filtra las opciones de los demás (cross-filter, no requiere completar en orden — ver
// catalogoCascada.ts). Diseñada para encontrar el producto correcto en el menor
// número de clics posible: la persona que vende no necesita saber navegar un árbol de
// categorías, solo estos 4 datos que ya conoce del pedido del cliente.
//
// Una sola fila (mismo alto que la barra de métricas de arriba, `px-3 py-2`) — antes
// tenía su propio título + una fila de labels arriba de los controles, y eso solo
// empujaba la grilla de productos hacia abajo sin aportar nada que el número de paso
// ya no dijera. Los labels van al costado del control, no arriba.

const PASO_NUM = 'w-4 h-4 rounded-full bg-gray-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0';
const LABEL_CLS = 'text-[10px] font-bold text-gray-600 uppercase tracking-wide shrink-0';
const SELECT_CLS = 'min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sky-500';

export function BusquedaCascada({ productos, valor, onChange }: {
  productos: Producto[];
  valor: CascadaFiltro;
  onChange: (next: CascadaFiltro) => void;
}) {
  const materiales = useMemo(() => opcionesMateriales(productos, valor), [productos, valor]);
  const familias   = useMemo(() => opcionesFamilias(productos, valor), [productos, valor]);
  const tipologias = useMemo(() => opcionesTipologias(productos, valor), [productos, valor]);
  const medidas    = useMemo(() => opcionesMedidas(productos, valor), [productos, valor]);

  // Si no hay ningún material cargado en el catálogo visible, el paso 1 no aporta nada
  // (pasaría siempre) — se oculta en vez de mostrar un selector vacío.
  if (materiales.length === 0 && familias.length === 0) return null;

  function set<K extends keyof CascadaFiltro>(campo: K, v: string) {
    onChange({ ...valor, [campo]: valor[campo] === v ? null : v });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-400 shadow-lg px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* 1. Material */}
      <div className="flex items-center gap-1.5">
        <span className={PASO_NUM}>1</span>
        <span className={LABEL_CLS}>Material</span>
        {materiales.length === 0 ? (
          <span className="text-xs text-gray-600 italic">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {materiales.map(m => (
              <button key={m.value} onClick={() => set('material', m.value)}
                className={cn('px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                  valor.material === m.value
                    ? 'bg-sky-600 border-sky-600 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50')}>
                {m.label} <span className="opacity-70">({m.count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Familia */}
      <div className="flex items-center gap-1.5">
        <span className={PASO_NUM}>2</span>
        <span className={LABEL_CLS}>Familia</span>
        <select value={valor.familiaId ?? ''} onChange={e => set('familiaId', e.target.value)} className={SELECT_CLS}>
          <option value="">Todas</option>
          {familias.map(f => <option key={f.value} value={f.value}>{f.label} ({f.count})</option>)}
        </select>
      </div>

      {/* 3. Tipología */}
      <div className="flex items-center gap-1.5">
        <span className={PASO_NUM}>3</span>
        <span className={LABEL_CLS}>Tipología</span>
        {tipologias.length === 0 ? (
          <span className="text-xs text-gray-600 italic">—</span>
        ) : (
          <select value={valor.tipologia ?? ''} onChange={e => set('tipologia', e.target.value)} className={SELECT_CLS}>
            <option value="">Todas</option>
            {tipologias.map(t => <option key={t.value} value={t.value}>{t.label} ({t.count})</option>)}
          </select>
        )}
      </div>

      {/* 4. Medida estándar */}
      <div className="flex items-center gap-1.5">
        <span className={PASO_NUM}>4</span>
        <span className={LABEL_CLS}>Medida</span>
        {medidas.length === 0 ? (
          <span className="text-xs text-gray-600 italic">—</span>
        ) : (
          <select value={valor.medida ?? ''} onChange={e => set('medida', e.target.value)} className={SELECT_CLS}>
            <option value="">Todas</option>
            {medidas.map(m => <option key={m.value} value={m.value}>{m.label} ({m.count})</option>)}
          </select>
        )}
      </div>

      {cascadaActiva(valor) && (
        <button onClick={() => onChange({ material: null, familiaId: null, tipologia: null, medida: null })}
          className="ml-auto text-[11px] text-sky-600 hover:underline font-medium shrink-0">
          Limpiar
        </button>
      )}
    </div>
  );
}
