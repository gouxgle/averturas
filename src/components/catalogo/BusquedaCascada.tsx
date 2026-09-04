import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
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

const PASO_NUM = 'w-4 h-4 rounded-full bg-gray-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0';
const SEL_LABEL = 'text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5';
const SELECT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500';

export function BusquedaCascada({ productos, valor, onChange }: {
  productos: Producto[];
  valor: CascadaFiltro;
  onChange: (next: CascadaFiltro) => void;
}) {
  const [medidaQuery, setMedidaQuery] = useState('');

  const materiales  = useMemo(() => opcionesMateriales(productos, valor), [productos, valor]);
  const familias     = useMemo(() => opcionesFamilias(productos, valor), [productos, valor]);
  const tipologias   = useMemo(() => opcionesTipologias(productos, valor), [productos, valor]);
  const medidasTodas = useMemo(() => opcionesMedidas(productos, valor), [productos, valor]);
  const medidas = medidaQuery.trim()
    ? medidasTodas.filter(m => m.label.replace(/\s/g, '').includes(medidaQuery.trim().replace(/\s/g, '')))
    : medidasTodas.slice(0, 8);

  // Si no hay ningún material cargado en el catálogo visible, el paso 1 no aporta nada
  // (pasaría siempre) — se oculta en vez de mostrar un selector vacío.
  if (materiales.length === 0 && familias.length === 0) return null;

  function set<K extends keyof CascadaFiltro>(campo: K, v: string) {
    onChange({ ...valor, [campo]: valor[campo] === v ? null : v });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Buscar por Material, Familia, Tipología y Medida</p>
        {cascadaActiva(valor) && (
          <button onClick={() => onChange({ material: null, familiaId: null, tipologia: null, medida: null })}
            className="text-[11px] text-sky-600 hover:underline font-medium">Limpiar</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Material */}
        <div>
          <p className={SEL_LABEL}><span className={PASO_NUM}>1</span> Material</p>
          {materiales.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Sin datos cargados</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {materiales.map(m => (
                <button key={m.value} onClick={() => set('material', m.value)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
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
        <div>
          <p className={SEL_LABEL}><span className={PASO_NUM}>2</span> Familia</p>
          <select value={valor.familiaId ?? ''} onChange={e => set('familiaId', e.target.value)} className={SELECT_CLS}>
            <option value="">Todas</option>
            {familias.map(f => <option key={f.value} value={f.value}>{f.label} ({f.count})</option>)}
          </select>
        </div>

        {/* 3. Tipología */}
        <div>
          <p className={SEL_LABEL}><span className={PASO_NUM}>3</span> Tipología</p>
          {tipologias.length === 0 ? (
            <p className="text-xs text-gray-600 italic pt-2">
              {valor.familiaId ? 'Sin dato para esta familia' : 'Elegí una familia primero'}
            </p>
          ) : (
            <select value={valor.tipologia ?? ''} onChange={e => set('tipologia', e.target.value)} className={SELECT_CLS}>
              <option value="">Todas</option>
              {tipologias.map(t => <option key={t.value} value={t.value}>{t.label} ({t.count})</option>)}
            </select>
          )}
        </div>

        {/* 4. Medida estándar */}
        <div>
          <p className={SEL_LABEL}><span className={PASO_NUM}>4</span> Medida estándar</p>
          {medidasTodas.length === 0 ? (
            <p className="text-xs text-gray-600 italic pt-2">Sin medidas cargadas</p>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <input value={medidaQuery} onChange={e => setMedidaQuery(e.target.value)}
                  placeholder="Buscar medida..."
                  className="w-full pl-2.5 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"/>
                {medidaQuery && (
                  <button onClick={() => setMedidaQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600">
                    <X size={12}/>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {medidas.map(m => (
                  <button key={m.value} onClick={() => set('medida', m.value)}
                    className={cn('px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
                      valor.medida === m.value
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50')}>
                    {m.label}
                  </button>
                ))}
                {medidas.length === 0 && <p className="text-xs text-gray-600 italic">Sin resultados</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
