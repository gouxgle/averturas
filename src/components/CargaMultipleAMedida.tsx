import { useState, useRef } from 'react';
import { X, Plus, Trash2, Layers, Calculator, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { MontoInput } from '@/components/MontoInput';
import type { TipoAbertura, Sistema } from '@/types';
import type { EditableItemSpec } from '@/components/EditItemModal';
import { EspecificacionesAbertura, inpCls, lblCls } from '@/components/EspecificacionesAbertura';
import type { ItemForm } from '@/pages/NuevoPresupuesto';
import {
  nuevaFilaMedida, superficieFila, filaCompleta, aplicarPrecioPorM2,
  totalFilas, expandirPlantillaAItems, type FilaMedida,
} from '@/lib/cargaMultiple';

// Carga varias aberturas iguales que solo difieren en las medidas: las
// características se eligen una vez arriba y abajo solo se tiran las medidas.
export function CargaMultipleAMedida({
  plantillaInicial, tiposAbertura, sistemas, coloresDB, nuevaKey, onConfirmar, onClose,
}: {
  plantillaInicial: ItemForm;
  tiposAbertura: TipoAbertura[];
  sistemas: Sistema[];
  coloresDB: { id: string; nombre: string }[];
  nuevaKey: () => string;
  onConfirmar: (items: ItemForm[]) => void;
  onClose: () => void;
}) {
  const [plantilla, setPlantilla] = useState<ItemForm>(plantillaInicial);
  const [filas, setFilas] = useState<FilaMedida[]>(
    () => [nuevaKey(), nuevaKey(), nuevaKey()].map(nuevaFilaMedida)
  );
  const [costoM2, setCostoM2] = useState('');
  const [ventaM2, setVentaM2] = useState('');
  const ultimaFilaRef = useRef<HTMLInputElement>(null);

  function updatePlantilla(_key: string, field: keyof EditableItemSpec, value: unknown) {
    setPlantilla(prev => ({ ...prev, [field]: value }));
  }

  function updateFila(key: string, patch: Partial<FilaMedida>) {
    setFilas(prev => prev.map(f => f._key === key ? { ...f, ...patch } : f));
  }

  function agregarFila() {
    setFilas(prev => [...prev, nuevaFilaMedida(nuevaKey())]);
    // Enfocar la fila recién agregada para poder seguir tipeando sin usar el mouse
    setTimeout(() => ultimaFilaRef.current?.focus(), 30);
  }

  function quitarFila(key: string) {
    setFilas(prev => prev.length === 1 ? prev : prev.filter(f => f._key !== key));
  }

  function aplicarM2() {
    const c = parseFloat(costoM2) || 0;
    const v = parseFloat(ventaM2) || 0;
    if (c <= 0 && v <= 0) { toast.error('Cargá un precio por m² primero'); return; }
    const antes = filas.filter(f => filaCompleta(f) && !f._precioManual).length;
    if (antes === 0) { toast.error('No hay filas con medida para calcular'); return; }
    setFilas(prev => aplicarPrecioPorM2(prev, c, v));
    toast.success(`Precio aplicado a ${antes} medida${antes !== 1 ? 's' : ''}`);
  }

  const validas = filas.filter(filaCompleta);
  const total = totalFilas(filas, plantilla.precio_instalacion, plantilla.incluye_instalacion);

  function confirmar() {
    if (!validas.length) { toast.error('Cargá al menos una medida (ancho y alto)'); return; }
    const tipoNombre = tiposAbertura.find(t => t.id === plantilla.tipo_abertura_id)?.nombre ?? '';
    const sistNombre = sistemas.find(s => s.id === plantilla.sistema_id)?.nombre ?? '';
    const fallback = [tipoNombre, sistNombre].filter(Boolean).join(' ') || 'Abertura a medida';
    onConfirmar(expandirPlantillaAItems(plantilla, filas, nuevaKey, fallback));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={17} className="text-violet-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900">Cargar varias medidas</h2>
              <p className="text-[11px] text-gray-600 truncate">Elegí las características una vez y cargá solo las medidas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
            <X size={16} className="text-gray-600" />
          </button>
        </div>

        {/* 1 — Características comunes */}
        <div className="p-5 space-y-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Características comunes</p>
            <span className="text-[11px] text-gray-600">— valen para todas las medidas</span>
          </div>
          <EspecificacionesAbertura
            item={plantilla}
            tiposAbertura={tiposAbertura}
            sistemas={sistemas}
            coloresDB={coloresDB}
            onChange={updatePlantilla}
            conPrecio
            conMedidas={false}
            conPrecioUnitario={false}
          />
        </div>

        {/* 2 — Medidas y precios */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Medidas y precios</p>
          </div>

          {/* Atajo por m² */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Calculator size={13} className="text-sky-600" />
              <p className="text-[11px] font-bold text-sky-700">Atajo: calcular por m²</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:items-end">
              <div>
                <label className={lblCls}>Costo por m²</label>
                <MontoInput value={costoM2} onChange={setCostoM2} className={inpCls} />
              </div>
              <div>
                <label className={lblCls}>Venta por m²</label>
                <MontoInput value={ventaM2} onChange={setVentaM2} className={inpCls} />
              </div>
              <button type="button" onClick={aplicarM2}
                className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold whitespace-nowrap">
                Aplicar a todas
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">
              Rellena las filas que tengan medida. Las que edites a mano quedan bloqueadas y no se recalculan.
            </p>
          </div>

          {/* Encabezado de la tabla — solo desktop; en mobile cada fila es una tarjeta */}
          <div className="hidden sm:grid gap-2 px-2 text-[10px] font-semibold text-gray-600 uppercase tracking-wider"
            style={{ gridTemplateColumns: '24px 1fr 1fr 52px 60px 1fr 1fr 32px' }}>
            <span>#</span><span>Ancho (m)</span><span>Alto (m)</span><span>m²</span><span>Cant.</span>
            <span>Costo</span><span>Venta</span><span></span>
          </div>

          <div className="space-y-2">
            {filas.map((f, idx) => {
              const m2 = superficieFila(f);
              const esUltima = idx === filas.length - 1;
              return (
                <div key={f._key}
                  className={cn(
                    'grid gap-2 items-center rounded-xl border p-2 sm:p-0 sm:border-0 sm:rounded-none',
                    'grid-cols-2 sm:grid-cols-[24px_1fr_1fr_52px_60px_1fr_1fr_32px]',
                    f._precioManual ? 'border-violet-200 bg-violet-50/40' : 'border-gray-200'
                  )}>
                  <span className="col-span-2 sm:col-span-1 text-[11px] font-bold text-gray-600 sm:text-center">
                    <span className="sm:hidden">Medida </span>{idx + 1}
                  </span>

                  <div>
                    <label className={cn(lblCls, 'sm:hidden')}>Ancho (m)</label>
                    <input
                      ref={esUltima ? ultimaFilaRef : undefined}
                      type="text" inputMode="decimal" value={f.ancho}
                      onChange={e => updateFila(f._key, { ancho: e.target.value })}
                      placeholder="1,20" className={cn(inpCls, 'text-center')}
                    />
                  </div>

                  <div>
                    <label className={cn(lblCls, 'sm:hidden')}>Alto (m)</label>
                    <input
                      type="text" inputMode="decimal" value={f.alto}
                      onChange={e => updateFila(f._key, { alto: e.target.value })}
                      placeholder="2,05" className={cn(inpCls, 'text-center')}
                    />
                  </div>

                  <span className="hidden sm:block text-[11px] text-gray-600 text-center tabular-nums">
                    {m2 > 0 ? m2.toFixed(2) : '—'}
                  </span>

                  <div>
                    <label className={cn(lblCls, 'sm:hidden')}>Cantidad</label>
                    <input
                      type="number" min={1} value={f.cantidad}
                      onChange={e => updateFila(f._key, { cantidad: parseInt(e.target.value) || 1 })}
                      className={cn(inpCls, 'text-center')}
                    />
                  </div>

                  <div>
                    <label className={cn(lblCls, 'sm:hidden')}>Costo</label>
                    <MontoInput
                      value={f.costo_unitario ? String(f.costo_unitario) : ''}
                      onChange={v => updateFila(f._key, { costo_unitario: parseFloat(v) || 0, _precioManual: true })}
                      className={inpCls}
                    />
                  </div>

                  <div>
                    <label className={cn(lblCls, 'sm:hidden')}>Venta</label>
                    <MontoInput
                      value={f.precio_unitario ? String(f.precio_unitario) : ''}
                      onChange={v => updateFila(f._key, { precio_unitario: parseFloat(v) || 0, _precioManual: true })}
                      className={inpCls}
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                    {f._precioManual && (
                      <span title="Precio puesto a mano — el cálculo por m² no lo pisa">
                        <Lock size={11} className="text-violet-500" />
                      </span>
                    )}
                    <button type="button" onClick={() => quitarFila(f._key)} disabled={filas.length === 1}
                      className="p-1.5 text-gray-600 hover:text-red-500 disabled:opacity-30" title="Quitar medida">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={agregarFila}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline">
            <Plus size={13} /> Agregar medida
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl sticky bottom-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {validas.length} medida{validas.length !== 1 ? 's' : ''} cargada{validas.length !== 1 ? 's' : ''}
              {filas.length > validas.length && (
                <span className="text-gray-500"> · {filas.length - validas.length} sin completar</span>
              )}
            </span>
            <span className="text-base font-bold text-violet-700 tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={onClose}
              className="sm:flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={confirmar} disabled={!validas.length}
              className="sm:flex-1 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold">
              Agregar {validas.length || ''} abertura{validas.length !== 1 ? 's' : ''} al presupuesto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
