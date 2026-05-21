import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X,
  Search, Upload, Download, RefreshCw, Tag,
  AlertCircle, Package,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Tipos ──────────────────────────────────────────────────────
interface Proveedor {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
}

interface PrecioProv {
  id: string;
  proveedor_id: string;
  sku: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  updated_at: string;
}

interface FilaForm {
  sku: string;
  descripcion: string;
  precio: string;
}

// ── Helpers ────────────────────────────────────────────────────
function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

function parseCsv(text: string): FilaForm[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const filas: FilaForm[] = [];

  for (const line of lines) {
    // Separa por coma o tabulación; respeta campos entre comillas
    const cols = line.match(/("(?:[^"]|"")*"|[^,\t]*)(?:[,\t]|$)/g)
      ?.map(c => c.replace(/,$/, '').replace(/^\t$/, '').replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim())
      ?? [];

    // Saltar header si la primera col no es numérica y la 3ra tampoco
    const [sku, descripcion, precioStr] = cols;
    if (!sku || !descripcion) continue;
    const precio = parseFloat(precioStr?.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!sku || sku.toLowerCase() === 'sku' || sku.toLowerCase() === 'codigo') continue;
    filas.push({ sku, descripcion, precio: isNaN(precio) ? '0' : String(precio) } as unknown as FilaForm);
  }
  return filas;
}

// ── Fila editable ──────────────────────────────────────────────
function FilaEditable({
  precio, onSave, onCancel,
}: {
  precio: PrecioProv;
  onSave: (data: Partial<PrecioProv>) => Promise<void>;
  onCancel: () => void;
}) {
  const [sku,  setSku]  = useState(precio.sku);
  const [desc, setDesc] = useState(precio.descripcion);
  const [prec, setPrec] = useState(String(precio.precio));
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({ sku, descripcion: desc, precio: parseFloat(prec) || 0 });
    setSaving(false);
  }

  return (
    <tr className="bg-amber-50">
      <td className="px-3 py-2">
        <input value={sku} onChange={e => setSku(e.target.value)}
          className="w-full border border-amber-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400" />
      </td>
      <td className="px-3 py-2">
        <input value={desc} onChange={e => setDesc(e.target.value)}
          className="w-full border border-amber-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
      </td>
      <td className="px-3 py-2">
        <input type="number" min={0} value={prec} onChange={e => setPrec(e.target.value)}
          className="w-full border border-amber-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-400" />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <button onClick={submit} disabled={saving}
            className="p-1.5 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button onClick={onCancel}
            className="p-1.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">
            <X size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Modal nueva fila ──────────────────────────────────────────
function NuevoPrecioModal({
  proveedorId, onSaved, onClose,
}: {
  proveedorId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [sku,  setSku]  = useState('');
  const [desc, setDesc] = useState('');
  const [prec, setPrec] = useState('');
  const [saving, setSaving] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);

  useEffect(() => { skuRef.current?.focus(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sku.trim() || !desc.trim()) { toast.error('SKU y descripción requeridos'); return; }
    setSaving(true);
    try {
      await api.post('/catalogo/proveedor-precios', {
        proveedor_id: proveedorId, sku: sku.trim(),
        descripcion: desc.trim(), precio: parseFloat(prec) || 0,
      });
      toast.success('Precio guardado');
      onSaved();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">Nuevo precio</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">SKU / Código *</label>
            <input ref={skuRef} value={sku} onChange={e => setSku(e.target.value)}
              placeholder="Ej: VEN-1200-PVC-BL"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Descripción *</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Ventana 1.20x0.80 PVC blanco"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Precio ($)</label>
            <input type="number" min={0} value={prec} onChange={e => setPrec(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-lime-500 text-white font-semibold py-2.5 rounded-xl hover:bg-lime-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Guardar
            </button>
            <button type="button" onClick={onClose}
              className="w-24 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal import CSV ───────────────────────────────────────────
function ImportCsvModal({
  proveedorId, onImported, onClose,
}: {
  proveedorId: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const [filas,    setFilas]    = useState<FilaForm[]>([]);
  const [paso,     setPaso]     = useState<'upload' | 'preview'>('upload');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error('No se encontraron filas válidas. Verificá el formato (sku,descripcion,precio)');
        return;
      }
      setFilas(parsed);
      setPaso('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function confirmarImport() {
    setImporting(true);
    try {
      const result = await api.post<{ insertados: number; actualizados: number; total: number }>(
        '/catalogo/proveedor-precios/import',
        {
          proveedor_id: proveedorId,
          filas: filas.map(f => ({
            sku: f.sku,
            descripcion: f.descripcion,
            precio: parseFloat(String(f.precio)) || 0,
          })),
        }
      );
      toast.success(`Importados: ${result.insertados} nuevos, ${result.actualizados} actualizados`);
      onImported();
    } catch {
      toast.error('Error en la importación');
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = 'sku,descripcion,precio\nVEN-1200-BL,Ventana 1.20x0.80 PVC blanco batiente,15000\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'template_precios.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">
            {paso === 'upload' ? 'Importar lista de precios CSV' : `Vista previa — ${filas.length} productos`}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        {paso === 'upload' && (
          <div className="p-5 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700">
                <p className="font-semibold mb-0.5">Formato requerido: 3 columnas</p>
                <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">sku,descripcion,precio</code>
                <p className="mt-1 opacity-70">Separador: coma o tabulación. La primera fila puede ser encabezado (se ignora si no es numérica).</p>
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-lime-400 hover:bg-lime-50 transition-colors"
            >
              <Upload size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Arrastrá un CSV o hacé click para seleccionar</p>
              <p className="text-xs text-gray-400 mt-1">Archivos .csv o .txt</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            </div>

            <button onClick={downloadTemplate}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <Download size={13} /> Descargar plantilla de ejemplo
            </button>
          </div>
        )}

        {paso === 'preview' && (
          <>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">SKU</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Descripción</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-700">{f.sku}</td>
                      <td className="px-4 py-2 text-gray-700">{f.descripcion}</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900">
                        {formatCurrency(parseFloat(String(f.precio)) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={confirmarImport} disabled={importing}
                className="flex-1 bg-lime-500 text-white font-semibold py-2.5 rounded-xl hover:bg-lime-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {importing
                  ? <><RefreshCw size={14} className="animate-spin" /> Importando...</>
                  : <><Check size={14} /> Confirmar importación ({filas.length})</>}
              </button>
              <button onClick={() => setPaso('upload')}
                className="w-28 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50">
                Volver
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────
export function ProveedorPrecios() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [precios,   setPrecios]   = useState<PrecioProv[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [editId,    setEditId]    = useState<string | null>(null);
  const [modal,     setModal]     = useState<'nuevo' | 'csv' | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [prov, lista] = await Promise.all([
        api.get<Proveedor>(`/catalogo/proveedores/${id}`),
        api.get<PrecioProv[]>(`/catalogo/proveedor-precios?proveedor_id=${id}`),
      ]);
      setProveedor(prov);
      setPrecios(lista);
    } catch {
      toast.error('Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleUpdate(precioId: string, data: Partial<PrecioProv>) {
    await api.put(`/catalogo/proveedor-precios/${precioId}`, data);
    toast.success('Actualizado');
    setEditId(null);
    await cargar();
  }

  async function handleDelete(precio: PrecioProv) {
    if (!window.confirm(`¿Eliminar "${precio.sku} — ${precio.descripcion}"?`)) return;
    await api.delete(`/catalogo/proveedor-precios/${precio.id}`);
    toast.success('Eliminado');
    cargar();
  }

  function downloadCsv() {
    const rows = precios.map(p =>
      `"${p.sku}","${p.descripcion.replace(/"/g, '""')}",${p.precio}`
    );
    const csv = ['sku,descripcion,precio', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precios_${proveedor?.nombre ?? id}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtrados = precios.filter(p => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return p.sku.toLowerCase().includes(s) || p.descripcion.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-lime-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 xl:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/proveedores')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">
            Lista de precios — {proveedor?.nombre ?? '…'}
          </h1>
          <p className="text-sm text-gray-500">
            {precios.length} productos · actualizada {precios.length > 0
              ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(
                  new Date(precios.reduce((a, b) => a.updated_at > b.updated_at ? a : b).updated_at)
                )
              : 'nunca'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {precios.length > 0 && (
            <button onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={14} /> Exportar
            </button>
          )}
          <button onClick={() => setModal('csv')}
            className="flex items-center gap-1.5 px-3 py-2 border border-lime-200 bg-lime-50 text-lime-700 rounded-xl text-sm font-medium hover:bg-lime-100 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => setModal('nuevo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-lime-500 text-white rounded-xl text-sm font-semibold hover:bg-lime-600 transition-colors">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Buscador */}
      {precios.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por SKU o descripción..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
          />
        </div>
      )}

      {/* Tabla */}
      {precios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <Tag size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="font-semibold text-gray-500 mb-1">Sin precios cargados</p>
          <p className="text-sm text-gray-400 mb-6">Agregá precios manualmente o importá un CSV del proveedor</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setModal('csv')}
              className="flex items-center gap-2 px-4 py-2.5 bg-lime-500 text-white rounded-xl font-semibold text-sm hover:bg-lime-600 transition-colors">
              <Upload size={15} /> Importar CSV
            </button>
            <button onClick={() => setModal('nuevo')}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
              <Plus size={15} /> Agregar uno
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['SKU / Código', 'Descripción', 'Precio', 'Acciones'].map(h => (
                  <th key={h} className={cn(
                    'px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider',
                    h === 'Precio' || h === 'Acciones' ? 'text-right' : 'text-left',
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                    Sin resultados para "{search}"
                  </td>
                </tr>
              ) : filtrados.map(precio => (
                editId === precio.id ? (
                  <FilaEditable key={precio.id} precio={precio}
                    onSave={data => handleUpdate(precio.id, data)}
                    onCancel={() => setEditId(null)} />
                ) : (
                  <tr key={precio.id} className={cn('hover:bg-gray-50', !precio.activo && 'opacity-50')}>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                        {precio.sku}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{precio.descripcion}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(Number(precio.precio))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditId(precio.id)}
                          className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(precio)}
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg" title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          {filtrados.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {filtrados.length} de {precios.length} productos
              </p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Package size={11} />
                Total lista: {formatCurrency(filtrados.reduce((a, b) => a + Number(b.precio), 0))}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modal === 'nuevo' && id && (
        <NuevoPrecioModal
          proveedorId={id}
          onSaved={() => { setModal(null); cargar(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'csv' && id && (
        <ImportCsvModal
          proveedorId={id}
          onImported={() => { setModal(null); cargar(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
