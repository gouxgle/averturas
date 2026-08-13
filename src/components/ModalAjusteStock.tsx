import { useState } from 'react';
import { Wrench, X, AlertTriangle, Info, Check, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Mínimo necesario para el modal — cualquier lista de productos con estos campos sirve
// (Stock.tsx pasa su ProductoStock más completo, que los incluye a todos).
export interface ProductoParaAjuste {
  id: string;
  nombre: string;
  codigo: string | null;
  stock_actual: number;
}

// Ajuste de inventario — mismo endpoint/comportamiento que usa Existencias (Stock.tsx),
// reutilizado también desde la ficha de producto (NuevoProducto.tsx) para no tener que
// salir a otra sección para corregir el stock. Deja rastro en stock_movimientos
// (tipo='ajuste') — a diferencia de editar "Stock inicial" directamente en el producto,
// que pisa la columna base sin dejar auditoría.
export function ModalAjusteStock({
  productos, onClose, onSaved, productoPreseleccionado, bloquearProducto, valorInicial,
}: {
  productos: ProductoParaAjuste[];
  onClose: () => void;
  onSaved: (nuevoStock: number) => void;
  productoPreseleccionado?: string;
  bloquearProducto?: boolean;
  valorInicial?: string;
}) {
  const [productoId, setProductoId] = useState(productoPreseleccionado ?? '');
  const [modo, setModo] = useState<'absoluto' | 'delta'>('absoluto');
  const [valor, setValor] = useState(valorInicial ?? '');
  const [motivo, setMotivo] = useState('Ajuste manual');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = productos.find(p => p.id === productoId);
  const delta = selected && valor !== '' ? (
    modo === 'absoluto'
      ? parseInt(valor) - selected.stock_actual
      : parseInt(valor)
  ) : null;

  async function handleSave() {
    if (!productoId) { setError('Seleccioná un producto'); return; }
    if (valor === '') { setError('Ingresá un valor'); return; }
    setSaving(true); setError('');
    try {
      const r = await api.post<{ en_salon_desactivado?: boolean }>('/stock/ajustar', {
        producto_id: productoId,
        cantidad:    delta,
        motivo:      motivo || 'Ajuste manual',
        notas:       notas  || null,
      });
      toast.success('Ajuste registrado');
      if (r.en_salon_desactivado) {
        toast.info('Se desactivó "Exhibido en salón" — el stock quedó en 0');
      }
      onSaved((selected?.stock_actual ?? 0) + (delta ?? 0));
    } catch (e: any) {
      setError(e?.message || 'Error al guardar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <Wrench size={18} className="text-gray-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Ajuste de inventario</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Producto *</label>
            {bloquearProducto && selected ? (
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700">
                {selected.nombre}{selected.codigo ? ` (${selected.codigo})` : ''} — stock: {selected.stock_actual}
              </div>
            ) : (
              <select value={productoId} onChange={e => setProductoId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Seleccioná un producto</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}{p.codigo ? ` (${p.codigo})` : ''} — stock: {p.stock_actual}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Modo de ajuste</label>
            <div className="flex gap-2">
              {(['absoluto', 'delta'] as const).map(m => (
                <button key={m} onClick={() => { setModo(m); setValor(''); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    modo === m ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {m === 'absoluto' ? 'Stock final' : 'Diferencia (+/-)'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              {modo === 'absoluto' ? 'Ingresá el total de unidades que hay físicamente.' : 'Ingresá +N para sumar o -N para restar.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {modo === 'absoluto' ? 'Stock final *' : 'Diferencia *'}
            </label>
            <input type="number" value={valor} onChange={e => setValor(e.target.value)}
              placeholder={modo === 'absoluto' ? '0' : '+5 o -3'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>

          {selected && delta !== null && valor !== '' && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
              delta === 0 ? 'bg-gray-50 text-gray-600' :
              delta > 0   ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              <Info size={14} />
              <span>
                Stock actual: <strong>{selected.stock_actual}</strong>
                {delta !== 0 && <> → nuevo: <strong>{selected.stock_actual + delta}</strong> ({delta > 0 ? '+' : ''}{delta})</>}
                {delta === 0 && <> — sin cambio</>}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Motivo</label>
            <select value={motivo} onChange={e => setMotivo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="Ajuste manual">Ajuste manual</option>
              <option value="Recuento físico">Recuento físico</option>
              <option value="Merma o rotura">Merma o rotura</option>
              <option value="Vencimiento">Vencimiento</option>
              <option value="Corrección de ingreso">Corrección de ingreso</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas</label>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || delta === 0}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            Aplicar ajuste
          </button>
        </div>
      </div>
    </div>
  );
}
