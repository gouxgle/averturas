import { useState, useEffect } from 'react';
import { Truck, Plus, Pencil, Check, X, ToggleLeft, ToggleRight, Globe, MapPin, Hash, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Proveedor {
  id: string; nombre: string; tipo: string | null; contacto: string | null;
  telefono: string | null; email: string | null; cuit: string | null;
  direccion: string | null; localidad: string | null; provincia: string | null;
  web: string | null; materiales: string[]; notas: string | null; activo: boolean;
}

const TIPO_PROVEEDOR = ['Fabricante', 'Revendedor', 'Importador'];
const MATERIALES_OPTS = ['Aluminio', 'PVC', 'Vidrio', 'Herrajes', 'Mosquiteros', 'Persianas', 'Portones', 'Otros'];
const TIPO_COLORS: Record<string, string> = {
  Fabricante: 'bg-violet-100 text-violet-700',
  Revendedor: 'bg-sky-100 text-sky-700',
  Importador: 'bg-amber-100 text-amber-700',
};

const emptyProveedor = (): Omit<Proveedor, 'id' | 'activo'> => ({
  nombre: '', tipo: '', contacto: '', telefono: '', email: '', cuit: '',
  direccion: '', localidad: '', provincia: '', web: '', materiales: [], notas: '',
});

function ProveedorForm({ initial, onSave, onCancel }: {
  initial: Omit<Proveedor, 'id' | 'activo'>;
  onSave: (vals: Omit<Proveedor, 'id' | 'activo'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  function set(field: string, value: unknown) { setForm(p => ({ ...p, [field]: value })); }

  function toggleMaterial(mat: string) {
    setForm(p => ({
      ...p,
      materiales: p.materiales.includes(mat)
        ? p.materiales.filter(m => m !== mat)
        : [...p.materiales, mat],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('Nombre requerido'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white';
  const lbl = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">
        {initial.nombre ? `Editar: ${initial.nombre}` : 'Nuevo proveedor'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className={lbl}>Nombre / Razón social *</label>
          <input required type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
            className={inp} placeholder="Ej: Aluminios del Norte S.A." autoFocus />
        </div>
        <div>
          <label className={lbl}>Tipo de proveedor</label>
          <select value={form.tipo ?? ''} onChange={e => set('tipo', e.target.value)} className={inp}>
            <option value="">— Sin especificar —</option>
            {TIPO_PROVEEDOR.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Persona de contacto</label>
          <input type="text" value={form.contacto ?? ''} onChange={e => set('contacto', e.target.value)}
            className={inp} placeholder="Nombre del vendedor / representante" />
        </div>
        <div>
          <label className={lbl}>Teléfono</label>
          <input type="text" value={form.telefono ?? ''} onChange={e => set('telefono', e.target.value)}
            className={inp} placeholder="+54 9 11 1234-5678" />
        </div>
        <div>
          <label className={lbl}>Email</label>
          <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)}
            className={inp} placeholder="ventas@proveedor.com" />
        </div>
        <div>
          <label className={lbl}>CUIT</label>
          <input type="text" value={form.cuit ?? ''} onChange={e => set('cuit', e.target.value)}
            className={inp} placeholder="30-12345678-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Dirección</label>
          <input type="text" value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value)}
            className={inp} placeholder="Calle y número" />
        </div>
        <div>
          <label className={lbl}>Localidad</label>
          <input type="text" value={form.localidad ?? ''} onChange={e => set('localidad', e.target.value)}
            className={inp} placeholder="Ciudad" />
        </div>
        <div>
          <label className={lbl}>Provincia</label>
          <input type="text" value={form.provincia ?? ''} onChange={e => set('provincia', e.target.value)}
            className={inp} placeholder="Buenos Aires" />
        </div>
      </div>

      <div>
        <label className={lbl}>Sitio web</label>
        <input type="url" value={form.web ?? ''} onChange={e => set('web', e.target.value)}
          className={inp} placeholder="https://www.proveedor.com" />
      </div>

      <div>
        <label className={lbl}>Materiales / rubros que provee</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {MATERIALES_OPTS.map(mat => (
            <button key={mat} type="button" onClick={() => toggleMaterial(mat)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border font-medium transition-colors',
                form.materiales.includes(mat)
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              )}>
              {mat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={lbl}>Notas internas</label>
        <textarea value={form.notas ?? ''} onChange={e => set('notas', e.target.value)}
          rows={2} className={inp + ' resize-none'}
          placeholder="Condiciones comerciales, plazo de entrega, descuentos..." />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm rounded-lg font-medium shadow-sm">
          <Check size={14} /> {saving ? 'Guardando...' : 'Guardar proveedor'}
        </button>
      </div>
    </form>
  );
}

export function Proveedores() {
  const [items, setItems] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);

  async function load() {
    try {
      const data = await api.get<Proveedor[]>('/catalogo/proveedores?all=1');
      setItems(data);
    } catch { /* */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(vals: Omit<Proveedor, 'id' | 'activo'>) {
    await api.post('/catalogo/proveedores', vals);
    toast.success('Proveedor agregado');
    setAdding(false);
    load();
  }

  async function handleEdit(id: string, vals: Omit<Proveedor, 'id' | 'activo'>) {
    const item = items.find(i => i.id === id)!;
    await api.put(`/catalogo/proveedores/${id}`, { ...vals, activo: item.activo });
    toast.success('Proveedor actualizado');
    setEditId(null);
    load();
  }

  async function toggleActivo(item: Proveedor) {
    await api.put(`/catalogo/proveedores/${item.id}`, { ...item, activo: !item.activo });
    load();
  }

  const filtered = items.filter(p => {
    if (soloActivos && !p.activo) return false;
    if (filtroTipo && p.tipo !== filtroTipo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.contacto ?? '').toLowerCase().includes(q) ||
        (p.localidad ?? '').toLowerCase().includes(q) ||
        (p.materiales ?? []).some(m => m.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Truck size={18} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Proveedores</h1>
            <p className="text-xs text-gray-400">{items.filter(p => p.activo).length} activos</p>
          </div>
        </div>
        <button
          onClick={() => { setAdding(true); setEditId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium shadow-sm">
          <Plus size={15} /> Nuevo proveedor
        </button>
      </div>

      {/* Form nueva */}
      {adding && (
        <ProveedorForm initial={emptyProveedor()} onSave={handleAdd} onCancel={() => setAdding(false)} />
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, ciudad, material..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
          <option value="">Todos los tipos</option>
          {TIPO_PROVEEDOR.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setSoloActivos(v => !v)}
          className={cn('px-3 py-2 text-sm rounded-lg border font-medium transition-colors',
            soloActivos ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-500')}>
          {soloActivos ? 'Solo activos' : 'Todos'}
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Truck size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {items.length === 0 ? 'Sin proveedores. Agregá el primero.' : 'Ninguno coincide con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id}>
              {editId === item.id ? (
                <ProveedorForm
                  initial={{ nombre: item.nombre, tipo: item.tipo, contacto: item.contacto,
                    telefono: item.telefono, email: item.email, cuit: item.cuit,
                    direccion: item.direccion, localidad: item.localidad, provincia: item.provincia,
                    web: item.web, materiales: item.materiales ?? [], notas: item.notas }}
                  onSave={vals => handleEdit(item.id, vals)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className={cn(
                  'bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-start gap-3 transition-opacity',
                  !item.activo && 'opacity-50'
                )}>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck size={16} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{item.nombre}</p>
                      {item.tipo && (
                        <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-full', TIPO_COLORS[item.tipo] ?? 'bg-gray-100 text-gray-600')}>
                          {item.tipo}
                        </span>
                      )}
                      {(item.materiales ?? []).map(m => (
                        <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{m}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {item.contacto && <span className="text-xs text-gray-500">{item.contacto}</span>}
                      {item.telefono && <span className="text-xs text-gray-400">{item.telefono}</span>}
                      {item.email   && <span className="text-xs text-gray-400">{item.email}</span>}
                      {(item.localidad || item.provincia) && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <MapPin size={10} />
                          {[item.localidad, item.provincia].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {item.cuit && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Hash size={10} /> {item.cuit}
                        </span>
                      )}
                      {item.web && (
                        <a href={item.web} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-sky-500 hover:underline flex items-center gap-0.5">
                          <Globe size={10} /> web
                        </a>
                      )}
                    </div>
                    {item.notas && <p className="text-xs text-gray-400 mt-1 italic">{item.notas}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditId(item.id); setAdding(false); }}
                      className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => toggleActivo(item)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                      title={item.activo ? 'Desactivar' : 'Activar'}>
                      {item.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
