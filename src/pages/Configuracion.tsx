import { useState, useEffect } from 'react';
import { SlidersHorizontal, Users, Building2, Truck, Palette, Plus, Pencil, Check, X, Layers, Settings2, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TipoAbertura { id: string; nombre: string; descripcion: string | null; icono: string | null; orden: number; activo: boolean; }
interface Sistema { id: string; nombre: string; material: string | null; descripcion: string | null; activo: boolean; }
interface Color { id: string; nombre: string; hex: string | null; activo: boolean; }
interface Empresa { id: string; nombre: string; cuit: string | null; telefono: string | null; email: string | null; direccion: string | null; logo_url: string | null; }

// ── Small inline form ─────────────────────────────────────────────────────────

function InlineForm({ fields, onSave, onCancel }: {
  fields: { key: string; label: string; value: string; placeholder?: string }[];
  onSave: (vals: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const init = Object.fromEntries(fields.map(f => [f.key, f.value]));
  const [vals, setVals] = useState(init);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSave(vals); } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-wrap gap-2 items-end bg-gray-50 rounded-lg p-3 border border-gray-200">
      {fields.map(f => (
        <div key={f.key} className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[11px] font-medium text-gray-500">{f.label}</label>
          <input
            className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            value={vals[f.key]}
            onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
            autoFocus={f === fields[0]}
          />
        </div>
      ))}
      <div className="flex gap-1.5">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white text-xs rounded-md font-medium">
          <Check size={13} /> {saving ? '...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Panel: Tipos de abertura ──────────────────────────────────────────────────

function PanelTiposAbertura() {
  const [items, setItems] = useState<TipoAbertura[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const data = await api.get<TipoAbertura[]>('/catalogo/tipos-abertura?all=1');
    setItems(data);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(vals: Record<string, string>) {
    await api.post('/catalogo/tipos-abertura', { nombre: vals.nombre, descripcion: vals.descripcion, orden: Number(vals.orden) || 0 });
    toast.success('Tipo agregado');
    setAdding(false);
    load();
  }

  async function handleEdit(id: string, vals: Record<string, string>) {
    const item = items.find(i => i.id === id)!;
    await api.put(`/catalogo/tipos-abertura/${id}`, { ...item, nombre: vals.nombre, descripcion: vals.descripcion, orden: Number(vals.orden) || 0 });
    toast.success('Actualizado');
    setEditId(null);
    load();
  }

  async function toggleActivo(item: TipoAbertura) {
    await api.put(`/catalogo/tipos-abertura/${item.id}`, { ...item, activo: !item.activo });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{items.filter(i => i.activo).length} activos</p>
        <button onClick={() => { setAdding(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium">
          <Plus size={13} /> Agregar
        </button>
      </div>

      {adding && (
        <InlineForm
          fields={[
            { key: 'nombre', label: 'Nombre *', value: '', placeholder: 'Ej: Ventana' },
            { key: 'descripcion', label: 'Descripción', value: '', placeholder: 'Opcional' },
            { key: 'orden', label: 'Orden', value: '0', placeholder: '0' },
          ]}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <div key={item.id} className={cn('py-2.5 flex items-center gap-3', !item.activo && 'opacity-50')}>
            <span className="w-6 text-xs text-gray-400 text-right">{item.orden}</span>
            <div className="flex-1 min-w-0">
              {editId === item.id ? (
                <InlineForm
                  fields={[
                    { key: 'nombre', label: 'Nombre *', value: item.nombre },
                    { key: 'descripcion', label: 'Descripción', value: item.descripcion ?? '' },
                    { key: 'orden', label: 'Orden', value: String(item.orden) },
                  ]}
                  onSave={vals => handleEdit(item.id, vals)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.nombre}</p>
                  {item.descripcion && <p className="text-xs text-gray-400">{item.descripcion}</p>}
                </div>
              )}
            </div>
            {editId !== item.id && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditId(item.id); setAdding(false); }}
                  className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100">
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleActivo(item)} className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100" title={item.activo ? 'Desactivar' : 'Activar'}>
                  {item.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Sin tipos cargados</p>}
      </div>
    </div>
  );
}

// ── Panel: Sistemas ───────────────────────────────────────────────────────────

function PanelSistemas() {
  const [items, setItems] = useState<Sistema[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const data = await api.get<Sistema[]>('/catalogo/sistemas?all=1');
    setItems(data);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(vals: Record<string, string>) {
    await api.post('/catalogo/sistemas', { nombre: vals.nombre, material: vals.material, descripcion: vals.descripcion });
    toast.success('Sistema agregado');
    setAdding(false);
    load();
  }

  async function handleEdit(id: string, vals: Record<string, string>) {
    const item = items.find(i => i.id === id)!;
    await api.put(`/catalogo/sistemas/${id}`, { ...item, nombre: vals.nombre, material: vals.material, descripcion: vals.descripcion });
    toast.success('Actualizado');
    setEditId(null);
    load();
  }

  async function toggleActivo(item: Sistema) {
    await api.put(`/catalogo/sistemas/${item.id}`, { ...item, activo: !item.activo });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{items.filter(i => i.activo).length} activos</p>
        <button onClick={() => { setAdding(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium">
          <Plus size={13} /> Agregar
        </button>
      </div>

      {adding && (
        <InlineForm
          fields={[
            { key: 'nombre', label: 'Nombre *', value: '', placeholder: 'Ej: Línea 30' },
            { key: 'material', label: 'Material', value: '', placeholder: 'aluminio, vidrio...' },
            { key: 'descripcion', label: 'Descripción', value: '', placeholder: 'Opcional' },
          ]}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <div key={item.id} className={cn('py-2.5 flex items-center gap-3', !item.activo && 'opacity-50')}>
            <div className="flex-1 min-w-0">
              {editId === item.id ? (
                <InlineForm
                  fields={[
                    { key: 'nombre', label: 'Nombre *', value: item.nombre },
                    { key: 'material', label: 'Material', value: item.material ?? '' },
                    { key: 'descripcion', label: 'Descripción', value: item.descripcion ?? '' },
                  ]}
                  onSave={vals => handleEdit(item.id, vals)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.nombre}</p>
                  {item.material && <p className="text-xs text-gray-400">{item.material}</p>}
                </div>
              )}
            </div>
            {editId !== item.id && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditId(item.id); setAdding(false); }}
                  className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100">
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleActivo(item)} className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100" title={item.activo ? 'Desactivar' : 'Activar'}>
                  {item.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Sin sistemas cargados</p>}
      </div>
    </div>
  );
}

// ── Panel: Colores ────────────────────────────────────────────────────────────

function PanelColores() {
  const [items, setItems] = useState<Color[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const data = await api.get<Color[]>('/catalogo/colores?all=1');
    setItems(data);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(vals: Record<string, string>) {
    await api.post('/catalogo/colores', { nombre: vals.nombre, hex: vals.hex || null });
    toast.success('Color agregado');
    setAdding(false);
    load();
  }

  async function handleEdit(id: string, vals: Record<string, string>) {
    const item = items.find(i => i.id === id)!;
    await api.put(`/catalogo/colores/${id}`, { ...item, nombre: vals.nombre, hex: vals.hex || null });
    toast.success('Actualizado');
    setEditId(null);
    load();
  }

  async function toggleActivo(item: Color) {
    await api.put(`/catalogo/colores/${item.id}`, { ...item, activo: !item.activo });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{items.filter(i => i.activo).length} activos</p>
        <button onClick={() => { setAdding(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium">
          <Plus size={13} /> Agregar
        </button>
      </div>

      {adding && (
        <InlineForm
          fields={[
            { key: 'nombre', label: 'Nombre *', value: '', placeholder: 'Ej: Champagne' },
            { key: 'hex', label: 'Color hex', value: '', placeholder: '#f7e7ce' },
          ]}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="divide-y divide-gray-100">
        {items.map(item => (
          <div key={item.id} className={cn('py-2.5 flex items-center gap-3', !item.activo && 'opacity-50')}>
            {item.hex ? (
              <div className="w-5 h-5 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: item.hex }} />
            ) : (
              <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {editId === item.id ? (
                <InlineForm
                  fields={[
                    { key: 'nombre', label: 'Nombre *', value: item.nombre },
                    { key: 'hex', label: 'Color hex', value: item.hex ?? '' },
                  ]}
                  onSave={vals => handleEdit(item.id, vals)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{item.nombre}</p>
                  {item.hex && <p className="text-xs text-gray-400 font-mono">{item.hex}</p>}
                </div>
              )}
            </div>
            {editId !== item.id && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditId(item.id); setAdding(false); }}
                  className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100">
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleActivo(item)} className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100" title={item.activo ? 'Desactivar' : 'Activar'}>
                  {item.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                </button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Sin colores cargados</p>}
      </div>
    </div>
  );
}

// ── Panel: Empresa ────────────────────────────────────────────────────────────

function PanelEmpresa() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', cuit: '', telefono: '', email: '', direccion: '' });

  useEffect(() => {
    api.get<Empresa>('/empresa').then(data => {
      if (data) setForm({
        nombre:    data.nombre    ?? '',
        cuit:      data.cuit      ?? '',
        telefono:  data.telefono  ?? '',
        email:     data.email     ?? '',
        direccion: data.direccion ?? '',
      });
      setLoading(false);
    });
  }, []);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      await api.put('/empresa', form);
      toast.success('Datos de empresa guardados');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Cargando...</p>;

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nombre / Razón social *</label>
          <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} placeholder="Aberturas del Valle" />
        </div>
        <div>
          <label className={labelCls}>CUIT</label>
          <input type="text" value={form.cuit} onChange={e => set('cuit', e.target.value)} className={inputCls} placeholder="20-12345678-9" />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input type="text" value={form.telefono} onChange={e => set('telefono', e.target.value)} className={inputCls} placeholder="+54 9 11 1234-5678" />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="info@empresa.com" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Dirección</label>
          <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)} className={inputCls} placeholder="Av. Siempreviva 742, Buenos Aires" />
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white text-sm rounded-lg font-medium">
          <Save size={14} />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Panel = 'empresa' | 'tipos_abertura' | 'sistemas' | 'colores' | null;

const GENERAL_BTNS: { id: 'empresa'; label: string; icon: typeof Building2; desc: string }[] = [
  { id: 'empresa', label: 'Empresa', icon: Building2, desc: 'Datos del negocio, CUIT, contacto' },
];

const CATALOG_BTNS: { id: Exclude<Panel, 'empresa' | null>; label: string; icon: typeof Layers; desc: string }[] = [
  { id: 'tipos_abertura', label: 'Tipos de abertura', icon: Layers,    desc: 'Ventana, puerta, celosía...' },
  { id: 'sistemas',       label: 'Sistemas',           icon: Settings2, desc: 'Líneas y materiales' },
  { id: 'colores',        label: 'Colores',             icon: Palette,   desc: 'Colores disponibles' },
];

const PENDING = [
  { icon: Users, label: 'Usuarios',    desc: 'Accesos y permisos del equipo',  color: 'text-blue-600',  bg: 'bg-blue-100' },
  { icon: Truck, label: 'Proveedores', desc: 'Gestión de proveedores',         color: 'text-amber-600', bg: 'bg-amber-100' },
];

function AccordionItem({ id, label, icon: Icon, desc, open, onToggle, children }: {
  id: string; label: string; icon: React.ElementType; desc: string;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-5 py-4 text-left transition-colors',
          open ? 'bg-slate-50' : 'hover:bg-gray-50'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', open ? 'bg-slate-200' : 'bg-gray-100')}>
            <Icon size={16} className={open ? 'text-slate-700' : 'text-gray-500'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
        </div>
        <X size={16} className={cn('text-gray-400 transition-transform', open ? 'rotate-0' : 'rotate-45')} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

export function Configuracion() {
  const [openPanel, setOpenPanel] = useState<Panel>(null);

  function togglePanel(id: Exclude<Panel, null>) {
    setOpenPanel(prev => (prev === id ? null : id));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
          <SlidersHorizontal size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500">Ajustes del sistema</p>
        </div>
      </div>

      {/* General */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {GENERAL_BTNS.map(({ id, label, icon, desc }) => (
            <AccordionItem key={id} id={id} label={label} icon={icon} desc={desc}
              open={openPanel === id} onToggle={() => togglePanel(id)}>
              <PanelEmpresa />
            </AccordionItem>
          ))}
        </div>
      </div>

      {/* Próximamente */}
      {PENDING.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PENDING.map(({ icon: Icon, label, desc, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 opacity-50 cursor-not-allowed">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={20} className={color} />
              </div>
              <p className="text-sm font-semibold text-gray-700">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              <span className="inline-block mt-3 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Próximamente
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Catálogo de productos */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Catálogo de productos</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {CATALOG_BTNS.map(({ id, label, icon, desc }, idx) => (
            <div key={id}>
              {idx > 0 && <div className="border-t border-gray-100" />}
              <AccordionItem id={id} label={label} icon={icon} desc={desc}
                open={openPanel === id} onToggle={() => togglePanel(id)}>
                {id === 'tipos_abertura' && <PanelTiposAbertura />}
                {id === 'sistemas'       && <PanelSistemas />}
                {id === 'colores'        && <PanelColores />}
              </AccordionItem>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
