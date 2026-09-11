import { X, Plus, Minus, Pencil } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { diffProforma, type DiffSnapshot, type CambioCampo } from '@/lib/diffProforma';

// Campos que se muestran como moneda en los chips de cambio.
const CAMPOS_MONEDA = new Set(['Precio', 'Precio de lista', 'Instalación', 'Costo de envío', 'Descuento']);
const CAMPOS_FECHA = new Set(['Válido hasta']);
const CAMPOS_BOOL = new Set(['Incluye instalación', 'Premarco']);

function fmtFecha(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T12:00:00')
    .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtValor(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (CAMPOS_MONEDA.has(campo)) return formatCurrency(Number(v));
  if (CAMPOS_FECHA.has(campo)) return fmtFecha(String(v));
  if (CAMPOS_BOOL.has(campo)) return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

function Chip({ c }: { c: CambioCampo }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2 py-0.5">
      <span className="font-semibold">{c.campo}:</span>
      <span className="line-through text-amber-600">{fmtValor(c.campo, c.antes)}</span>
      <span>→</span>
      <span className="font-semibold">{fmtValor(c.campo, c.despues)}</span>
    </span>
  );
}

function nombreItem(it: { descripcion: string; producto_nombre?: string | null } | undefined): string {
  return it?.producto_nombre || it?.descripcion || '—';
}

export function ComparadorRevisiones({
  a, b, labelA, labelB, numero, onClose,
}: {
  a: DiffSnapshot; b: DiffSnapshot; labelA: string; labelB: string; numero?: string; onClose: () => void;
}) {
  const d = diffProforma(a, b);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900">{numero ? `${numero} — Qué cambió` : 'Qué cambió'}</p>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">{labelA}</span> → <span className="font-semibold">{labelB}</span>
            </p>
          </div>
          <button onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* Total con delta */}
          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{labelA}</p>
                <p className="text-sm font-bold text-gray-500 line-through tabular-nums">{formatCurrency(d.total.antes)}</p>
              </div>
              <span className="text-gray-400">→</span>
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{labelB}</p>
                <p className="text-lg font-black text-gray-900 tabular-nums">{formatCurrency(d.total.despues)}</p>
              </div>
            </div>
            {Math.abs(d.total.delta) > 0.01 && (
              <span className={cn(
                'text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto',
                d.total.delta > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
              )}>
                {d.total.delta > 0 ? '+' : ''}{formatCurrency(d.total.delta)} ({d.total.delta_pct > 0 ? '+' : ''}{d.total.delta_pct.toFixed(1)}%)
              </span>
            )}
          </div>

          {/* Resumen */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {d.resumen.agregados > 0 && (
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 font-semibold">
                <Plus size={11} /> {d.resumen.agregados} agregado{d.resumen.agregados !== 1 ? 's' : ''}
              </span>
            )}
            {d.resumen.quitados > 0 && (
              <span className="flex items-center gap-1 bg-red-50 text-red-700 rounded-full px-2 py-0.5 font-semibold">
                <Minus size={11} /> {d.resumen.quitados} quitado{d.resumen.quitados !== 1 ? 's' : ''}
              </span>
            )}
            {d.resumen.modificados > 0 && (
              <span className="flex items-center gap-1 bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 font-semibold">
                <Pencil size={11} /> {d.resumen.modificados} modificado{d.resumen.modificados !== 1 ? 's' : ''}
              </span>
            )}
            {d.resumen.agregados === 0 && d.resumen.quitados === 0 && d.resumen.modificados === 0 && (
              <span className="text-gray-600">Los ítems no cambiaron.</span>
            )}
          </div>

          {/* Cambios de header */}
          {d.header.length > 0 && (
            <div className="rounded-xl border border-gray-200 px-3 py-2.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Condiciones</p>
              <div className="flex flex-wrap gap-1.5">
                {d.header.map((c, i) => <Chip key={i} c={c} />)}
              </div>
            </div>
          )}

          {/* Ítems */}
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {d.items.map((f, i) => {
              const it = f.despues ?? f.antes;
              return (
                <div key={i} className={cn(
                  'px-3 py-2.5',
                  f.estado === 'agregado' && 'bg-emerald-50/60',
                  f.estado === 'quitado'  && 'bg-red-50/60',
                  f.estado === 'modificado' && 'bg-amber-50/40',
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-[13px] font-medium',
                        f.estado === 'quitado' ? 'text-gray-500 line-through' : 'text-gray-800',
                      )}>
                        {nombreItem(it)}
                        {it && it.cantidad > 1 && <span className="text-gray-600"> × {it.cantidad}</span>}
                      </p>
                      {f.estado === 'agregado' && <span className="text-[10px] font-bold text-emerald-700">Agregado</span>}
                      {f.estado === 'quitado'  && <span className="text-[10px] font-bold text-red-700">Quitado</span>}
                    </div>
                    {it && (
                      <span className="text-[13px] font-bold text-gray-800 tabular-nums shrink-0">
                        {formatCurrency(Number(it.precio_total ?? it.precio_unitario * it.cantidad))}
                      </span>
                    )}
                  </div>
                  {f.cambios.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {f.cambios.map((c, j) => <Chip key={j} c={c} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Formas de pago */}
          {d.formas_pago.some(f => f.estado !== 'igual') && (
            <div className="rounded-xl border border-gray-200 px-3 py-2.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Formas de pago</p>
              <div className="space-y-1">
                {d.formas_pago.filter(f => f.estado !== 'igual').map((f, i) => {
                  const fp = (f.despues ?? f.antes) as unknown as { nombre: string } | undefined;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {f.estado === 'agregado' && <span className="text-emerald-700 font-semibold">+ {fp?.nombre}</span>}
                      {f.estado === 'quitado'  && <span className="text-red-700 line-through">{fp?.nombre}</span>}
                      {f.estado === 'modificado' && (
                        <>
                          <span className="font-semibold text-gray-800">{fp?.nombre}</span>
                          {f.cambios.map((c, j) => <Chip key={j} c={c} />)}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 sm:px-5 py-3 flex justify-end">
          <button onClick={onClose} className="h-11 px-6 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
