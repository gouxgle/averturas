import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { isPromoActiva } from '@/components/TarjetaProductoMosaico';
import type { Producto } from '@/types';

export interface ItemCambio {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  stock_actual: number;
}

// Producto que el cliente se lleva a cambio: solo lo que tiene stock (se entrega en el momento).
// Precio sugerido = el del catálogo (o el promocional vigente), editable como en la venta rápida.
export function SelectorCambio({ items, onChange }: { items: ItemCambio[]; onChange: (items: ItemCambio[]) => void }) {
  const [catalogo, setCatalogo] = useState<Producto[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { api.get<Producto[]>('/productos').then(setCatalogo).catch(() => setCatalogo([])); }, []);

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return (catalogo ?? [])
      .filter(p => p.activo && (p.stock_actual ?? 0) > 0)
      .filter(p => p.nombre.toLowerCase().includes(t) || p.codigo?.toLowerCase().includes(t))
      .slice(0, 12);
  }, [catalogo, q]);

  function agregar(p: Producto) {
    const promo = isPromoActiva(p) && p.promocion?.precio_oferta ? Number(p.promocion.precio_oferta) : null;
    onChange(items.some(i => i.producto_id === p.id)
      ? items.map(i => i.producto_id === p.id ? { ...i, cantidad: Math.min(i.cantidad + 1, i.stock_actual) } : i)
      : [...items, { producto_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: promo ?? Number(p.precio_base), stock_actual: p.stock_actual ?? 0 }]);
    setQ('');
  }
  const cambiar = (id: string, parcial: Partial<ItemCambio>) => onChange(items.map(i => i.producto_id === id ? { ...i, ...parcial } : i));

  return (
    <div className="space-y-3" data-testid="selector-cambio">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar el producto nuevo por nombre o código"
          className="w-full h-11 pl-9 pr-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
        {catalogo === null && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-amber-500" />}
      </div>

      {q.trim() && (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {resultados.length === 0
            ? <p className="p-3 text-sm text-gray-600">{catalogo === null ? 'Cargando catálogo…' : 'Sin productos con stock que coincidan.'}</p>
            : resultados.map(p => (
              <button key={p.id} type="button" onClick={() => agregar(p)} className="w-full text-left px-3 py-2.5 hover:bg-amber-50 min-h-[52px] flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 break-words">{p.nombre}</span>
                  <span className="block text-[11px] text-gray-600">{p.codigo ? `Cód. ${p.codigo} · ` : ''}Stock {p.stock_actual}</span>
                </span>
                <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{formatCurrency(Number(p.precio_base))}</span>
                <Plus size={16} className="text-amber-600 shrink-0" />
              </button>
            ))}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-600">Buscá y elegí el producto que se lleva el cliente.</p>
      ) : (
        <div className="space-y-2">
          {items.map(i => (
            <div key={i.producto_id} className="rounded-xl border border-amber-300 bg-amber-50/40 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 break-words">{i.nombre}</p>
                <button type="button" onClick={() => onChange(items.filter(x => x.producto_id !== i.producto_id))} aria-label="Quitar"
                  className="w-9 h-9 rounded-lg hover:bg-white flex items-center justify-center text-gray-600 shrink-0"><X size={16} /></button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => cambiar(i.producto_id, { cantidad: Math.max(1, i.cantidad - 1) })} aria-label="Menos"
                    className="w-11 h-11 rounded-lg border border-gray-300 bg-white flex items-center justify-center"><Minus size={16} /></button>
                  <span className="w-7 text-center font-bold tabular-nums">{i.cantidad}</span>
                  <button type="button" onClick={() => cambiar(i.producto_id, { cantidad: Math.min(i.cantidad + 1, i.stock_actual) })} disabled={i.cantidad >= i.stock_actual} aria-label="Más"
                    className="w-11 h-11 rounded-lg border border-gray-300 bg-white flex items-center justify-center disabled:opacity-30"><Plus size={16} /></button>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-700 ml-auto">
                  Precio c/u
                  <input value={String(i.precio_unitario)} inputMode="decimal"
                    onChange={e => cambiar(i.producto_id, { precio_unitario: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                    className={cn('w-28 h-11 border rounded-xl px-2 text-base text-right focus:outline-none focus:ring-2',
                      i.precio_unitario > 0 ? 'border-gray-300 focus:ring-amber-400' : 'border-red-400 focus:ring-red-400')} />
                </label>
              </div>
              <p className="text-right text-xs text-gray-600">Subtotal <b className="text-gray-900">{formatCurrency(i.cantidad * i.precio_unitario)}</b></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
