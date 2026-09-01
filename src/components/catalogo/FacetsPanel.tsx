import { SlidersHorizontal } from 'lucide-react';
import type { FacetDef } from '@/lib/catalogoFiltros';

// Panel de filtros por atributo. Compartido entre la sección Productos (sidebar
// desktop + drawer mobile) y el modal de catálogo del presupuesto.
export function FacetsPanel({ facets, activos, onToggle, onLimpiar, activeCount }: {
  facets: FacetDef[]; activos: Record<string, string[]>;
  onToggle: (key: string, value: string) => void; onLimpiar: () => void; activeCount: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <SlidersHorizontal size={13}/> Filtrar productos
        </p>
        {activeCount > 0 && (
          <button onClick={onLimpiar} className="text-[11px] text-sky-600 hover:underline font-medium">Limpiar</button>
        )}
      </div>
      {facets.map(f => (
        <div key={f.key} className="space-y-1.5 pt-3 border-t border-gray-200 first:border-0 first:pt-0">
          <p className="text-[11px] font-semibold text-gray-600">{f.label}</p>
          <div className="space-y-1">
            {f.options.map(opt => {
              const checked = (activos[f.key] ?? []).includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                  <input
                    type="checkbox" checked={checked}
                    onChange={() => onToggle(f.key, opt.value)}
                    className="w-3.5 h-3.5 rounded border-gray-400 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="capitalize flex-1">{opt.label}</span>
                  <span className="text-[10px] text-gray-600">({opt.count})</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
