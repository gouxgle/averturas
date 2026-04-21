import { useState, useEffect } from 'react';
import { SlidersHorizontal, Users, Building2, Truck, Palette, Plus, Pencil, Check, X, Layers, Settings2, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TipoAbertura { id: string; nombre: string; descripcion: string | null; icono: string | null; orden: number; activo: boolean; }
interface Sistema { id: string; nombre: string; material: string | null; descripcion: string | null; activo: boolean; }
interface Color { id: string; nombre: string; hex: string | null; activo: boolean; }

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

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'tipos_abertura' | 'sistemas' | 'colores';

const ACTIVE_TABS: { id: Tab; label: string; icon: typeof Layers; desc: string }[] = [
  { id: 'tipos_abertura', label: 'Tipos de abertura', icon: Layers,    desc: 'Ventana, puerta, celosía...' },
  { id: 'sistemas',       label: 'Sistemas',           icon: Settings2, desc: 'Líneas y materiales' },
  { id: 'colores',        label: 'Colores',             icon: Palette,   desc: 'Colores disponibles' },
];

const PENDING = [
  { icon: Building2, label: 'Empresa',     desc: 'Datos del negocio, logo, CUIT',  color: 'text-slate-600', bg: 'bg-slate-100' },
  { icon: Users,     label: 'Usuarios',    desc: 'Accesos y permisos del equipo',  color: 'text-blue-600',  bg: 'bg-blue-100' },
  { icon: Truck,     label: 'Proveedores', desc: 'Gestión de proveedores',         color: 'text-amber-600', bg: 'bg-amber-100' },
];

export function Configuracion() {
  const [tab, setTab] = useState<Tab>('tipos_abertura');

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

      {/* Catálogo de productos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Catálogo de productos</h2>
          <p className="text-xs text-gray-400 mt-0.5">Opciones disponibles en los desplegables al crear productos</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          {ACTIVE_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                tab === id
                  ? 'border-slate-700 text-slate-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="p-5">
          {tab === 'tipos_abertura' && <PanelTiposAbertura />}
          {tab === 'sistemas'       && <PanelSistemas />}
          {tab === 'colores'        && <PanelColores />}
        </div>
      </div>

      {/* Próximamente */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Próximamente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PENDING.map(({ icon: Icon, label, desc, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 opacity-60 cursor-not-allowed">
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
      </div>
    </div>
  );
}
