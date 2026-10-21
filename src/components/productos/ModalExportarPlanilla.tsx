import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, X, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { exportarPlanilla } from '@/lib/planillaPrecios';
import type { Producto } from '@/types';

// Exportar la planilla Excel de precios de un proveedor desde Productos: elige proveedor (y si incluye los
// dados de baja) y descarga el .xlsx con la columna "Nuevo precio de lista" en blanco. Se vuelve a subir en
// Revisión de precios → Lista del proveedor.
export function ModalExportarPlanilla({ productos, proveedorInicial, onClose }: {
  productos: Producto[]; proveedorInicial?: string; onClose: () => void;
}) {
  const proveedores = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const p of productos) if (p.proveedor?.id) m.set(p.proveedor.id, { nombre: p.proveedor.nombre, n: (m.get(p.proveedor.id)?.n ?? 0) + (p.activo ? 1 : 0) });
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  }, [productos]);
  const [proveedorId, setProveedorId] = useState(proveedorInicial && proveedores.some(([k]) => k === proveedorInicial) ? proveedorInicial : '');
  const [soloActivos, setSoloActivos] = useState(true);
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    if (!proveedorId || exportando) return;
    setExportando(true);
    try {
      const r = await exportarPlanilla(proveedorId, { soloActivos });
      toast.success(`Planilla de ${r.proveedor} descargada (${r.filas} productos)`, { description: 'Completá "Nuevo precio de lista (costo)" y subila en Revisión de precios → Lista del proveedor.' });
      onClose();
    } catch (e) {
      toast.error('No se pudo exportar', { description: (e as Error).message });
    } finally {
      setExportando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !exportando) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md max-h-[90dvh] mt-auto sm:mt-0 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col" data-testid="modal-exportar-planilla">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <span className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><FileSpreadsheet size={17} className="text-emerald-700" /></span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight">Exportar planilla de precios</p>
            <p className="text-xs text-gray-600">Excel por proveedor para cargar nuevos precios</p>
          </div>
          <button type="button" onClick={onClose} disabled={exportando} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <label className="block text-xs font-bold text-gray-800">Proveedor
            <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-300 bg-white text-base font-normal">
              <option value="">Elegí un proveedor…</option>
              {proveedores.map(([k, v]) => <option key={k} value={k}>{v.nombre} ({v.n} productos)</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-800 min-h-[44px] cursor-pointer">
            <input type="checkbox" className="w-5 h-5" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} /> Solo productos activos
          </label>
          <div className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="font-bold text-gray-800">El Excel trae</p>
            <p>Código, nombre y descripción, <b>precio de lista actual</b> (costo), <b>precio de venta actual</b> y una columna en blanco <b>"Nuevo precio de lista (costo)"</b>.</p>
            <p>Después se sube en <b>Revisión de precios → Lista del proveedor</b>: el sistema recalcula el precio de venta y muestra la vista previa antes de aplicar.</p>
          </div>
        </div>
        <div className="border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
          <button type="button" onClick={onClose} disabled={exportando} className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">Cancelar</button>
          <button type="button" onClick={exportar} disabled={!proveedorId || exportando} data-testid="descargar-planilla"
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Descargar Excel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
