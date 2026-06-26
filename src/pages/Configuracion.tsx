import { useState, useEffect } from 'react';
import { SlidersHorizontal, Users, Building2, Palette, Plus, Pencil, Check, X, Layers, Settings2, ToggleLeft, ToggleRight, Save, Eye, EyeOff, MessageSquare, MapPin, Trash2, GripVertical } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { SectionHero } from '@/components/SectionHero';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TipoAbertura { id: string; nombre: string; descripcion: string | null; icono: string | null; orden: number; activo: boolean; margen_venta: number | null; }
interface Sistema { id: string; nombre: string; material: string | null; descripcion: string | null; activo: boolean; }
interface Color { id: string; nombre: string; hex: string | null; activo: boolean; }
interface Empresa { id: string; nombre: string; cuit: string | null; telefono: string | null; email: string | null; direccion: string | null; logo_url: string | null; instagram: string | null; terminos_url: string | null; }
interface Usuario { id: string; nombre: string; email: string; rol: 'admin' | 'vendedor' | 'consulta'; activo: boolean; created_at: string; }

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
    await api.post('/catalogo/tipos-abertura', {
      nombre: vals.nombre, descripcion: vals.descripcion, orden: Number(vals.orden) || 0,
      margen_venta: vals.margen_venta !== '' ? Number(vals.margen_venta) : null,
    });
    toast.success('Tipo agregado');
    setAdding(false);
    load();
  }

  async function handleEdit(id: string, vals: Record<string, string>) {
    const item = items.find(i => i.id === id)!;
    await api.put(`/catalogo/tipos-abertura/${id}`, {
      ...item, nombre: vals.nombre, descripcion: vals.descripcion, orden: Number(vals.orden) || 0,
      margen_venta: vals.margen_venta !== '' ? Number(vals.margen_venta) : null,
    });
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
            { key: 'margen_venta', label: 'Margen %', value: '', placeholder: 'Ej: 45' },
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
                    { key: 'margen_venta', label: 'Margen %', value: item.margen_venta != null ? String(item.margen_venta) : '', placeholder: 'Ej: 45' },
                  ]}
                  onSave={vals => handleEdit(item.id, vals)}
                  onCancel={() => setEditId(null)}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{item.nombre}</p>
                    {item.descripcion && <p className="text-xs text-gray-400">{item.descripcion}</p>}
                  </div>
                  {item.margen_venta != null && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                      {item.margen_venta}%
                    </span>
                  )}
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
  const [form, setForm] = useState({ nombre: '', cuit: '', telefono: '', email: '', direccion: '', instagram: '', terminos_url: '' });

  useEffect(() => {
    api.get<Empresa>('/empresa').then(data => {
      if (data) setForm({
        nombre:       data.nombre       ?? '',
        cuit:         data.cuit         ?? '',
        telefono:     data.telefono     ?? '',
        email:        data.email        ?? '',
        direccion:    data.direccion    ?? '',
        instagram:    data.instagram    ?? '',
        terminos_url: data.terminos_url ?? '',
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
        <div>
          <label className={labelCls}>Instagram</label>
          <input type="text" value={form.instagram} onChange={e => set('instagram', e.target.value)} className={inputCls} placeholder="@tulocal" />
        </div>
        <div>
          <label className={labelCls}>URL Términos y Condiciones</label>
          <input type="url" value={form.terminos_url} onChange={e => set('terminos_url', e.target.value)} className={inputCls} placeholder="https://www.cesarbritez.com.ar/condiciones" />
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

// ── Panel: Usuarios ──────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = { admin: 'Administrador', vendedor: 'Vendedor', consulta: 'Solo lectura' };
const ROL_COLORS: Record<string, string> = {
  admin:    'bg-violet-100 text-violet-700',
  vendedor: 'bg-sky-100 text-sky-700',
  consulta: 'bg-gray-100 text-gray-600',
};

const emptyUserForm = () => ({ nombre: '', email: '', password: '', rol: 'vendedor' as Usuario['rol'] });

function UserForm({ initial, onSave, onCancel, isEdit, currentUserId }: {
  initial: { nombre: string; email: string; password: string; rol: Usuario['rol'] };
  onSave: (vals: typeof initial) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
  currentUserId?: string;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  function set(field: string, value: string) { setForm(p => ({ ...p, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-gray-100 rounded-xl border border-gray-300 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input required type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inputCls} placeholder="Juan Pérez" />
        </div>
        <div>
          <label className={labelCls}>Email *</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="juan@empresa.com" />
        </div>
        <div className="relative">
          <label className={labelCls}>{isEdit ? 'Nueva contraseña (dejar vacío = no cambiar)' : 'Contraseña *'}</label>
          <input
            type={showPwd ? 'text' : 'password'}
            required={!isEdit}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            className={inputCls + ' pr-9'}
            placeholder={isEdit ? '••••••••' : 'Mínimo 6 caracteres'}
          />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            className="absolute right-2.5 bottom-2 text-gray-400 hover:text-gray-600">
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <div>
          <label className={labelCls}>Rol *</label>
          <select value={form.rol} onChange={e => set('rol', e.target.value)} className={inputCls}>
            <option value="admin">Administrador</option>
            <option value="vendedor">Vendedor</option>
            <option value="consulta">Solo lectura</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white text-sm rounded-lg font-medium">
          <Check size={14} /> {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}

function PanelUsuarios({ currentUserId }: { currentUserId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.get<Usuario[]>('/usuarios');
      setUsuarios(data);
    } catch { /* non-admin sees nothing */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleAdd(vals: ReturnType<typeof emptyUserForm>) {
    await api.post('/usuarios', vals);
    toast.success('Usuario creado');
    setAdding(false);
    load();
  }

  async function handleEdit(id: string, vals: ReturnType<typeof emptyUserForm>) {
    await api.put(`/usuarios/${id}`, { ...vals, activo: true });
    toast.success('Usuario actualizado');
    setEditId(null);
    load();
  }

  async function toggleActivo(u: Usuario) {
    try {
      await api.put(`/usuarios/${u.id}`, { nombre: u.nombre, email: u.email, rol: u.rol, activo: !u.activo, password: '' });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading) return <p className="text-sm text-gray-400 py-4">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{usuarios.filter(u => u.activo).length} activos · {usuarios.length} total</p>
        <button onClick={() => { setAdding(true); setEditId(null); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium">
          <Plus size={13} /> Nuevo usuario
        </button>
      </div>

      {adding && (
        <UserForm
          initial={emptyUserForm()}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          isEdit={false}
          currentUserId={currentUserId}
        />
      )}

      <div className="divide-y divide-gray-100">
        {usuarios.map(u => (
          <div key={u.id} className={cn('py-3', !u.activo && 'opacity-50')}>
            {editId === u.id ? (
              <UserForm
                initial={{ nombre: u.nombre, email: u.email, password: '', rol: u.rol }}
                onSave={vals => handleEdit(u.id, vals)}
                onCancel={() => setEditId(null)}
                isEdit={true}
                currentUserId={currentUserId}
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-slate-600">{u.nombre.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{u.nombre}</p>
                    <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-full', ROL_COLORS[u.rol])}>
                      {ROL_LABELS[u.rol]}
                    </span>
                    {u.id === currentUserId && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Vos</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditId(u.id); setAdding(false); }}
                    className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => toggleActivo(u)}
                    className="p-1.5 text-gray-400 hover:text-slate-600 rounded hover:bg-gray-100"
                    title={u.activo ? 'Desactivar' : 'Activar'}>
                    {u.activo ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {usuarios.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Sin usuarios</p>}
      </div>
    </div>
  );
}

// ── Panel: Mensajes WhatsApp ──────────────────────────────────────────────────

interface MensajePlantilla {
  clave: string;
  titulo: string;
  contenido: string;
  variables: string;
}

const LABELS_CLAVE: Record<string, string> = {
  pedido_proveedor:       'Pedido al proveedor',
  presupuesto_aprobacion: 'Presupuesto para aprobación',
  remito_cliente:         'Remito al cliente',
};

function PanelMensajes() {
  const [plantillas, setPlantillas] = useState<MensajePlantilla[]>([]);
  const [editando, setEditando]   = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get<MensajePlantilla[]>('/configuracion/mensajes').then(data => {
      setPlantillas(data);
      setEditando(Object.fromEntries(data.map(p => [p.clave, p.contenido])));
    });
  }, []);

  async function guardar(clave: string) {
    setSaving(s => ({ ...s, [clave]: true }));
    try {
      await api.put(`/configuracion/mensajes/${clave}`, { contenido: editando[clave] });
      setPlantillas(ps => ps.map(p => p.clave === clave ? { ...p, contenido: editando[clave] } : p));
      toast.success('Mensaje guardado');
    } finally {
      setSaving(s => ({ ...s, [clave]: false }));
    }
  }

  function resetear(clave: string) {
    const orig = plantillas.find(p => p.clave === clave)?.contenido ?? '';
    setEditando(e => ({ ...e, [clave]: orig }));
  }

  if (!plantillas.length) return <p className="text-sm text-gray-400 py-2">Cargando...</p>;

  return (
    <div className="space-y-6 pt-1">
      {plantillas.map(p => {
        const dirty = editando[p.clave] !== p.contenido;
        return (
          <div key={p.clave} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{LABELS_CLAVE[p.clave] ?? p.titulo}</p>
              <div className="flex gap-1.5">
                {dirty && (
                  <button onClick={() => resetear(p.clave)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded">
                    Descartar
                  </button>
                )}
                <button onClick={() => guardar(p.clave)} disabled={!dirty || saving[p.clave]}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-xs rounded-md font-medium">
                  <Save size={12} /> {saving[p.clave] ? '...' : 'Guardar'}
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={editando[p.clave] ?? ''}
              onChange={e => setEditando(ed => ({ ...ed, [p.clave]: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-slate-400 bg-gray-50"
            />

            {p.variables && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Variables:</span>
                {p.variables.split(',').map(v => v.trim()).filter(Boolean).map(v => (
                  <button key={v}
                    onClick={() => setEditando(ed => ({ ...ed, [p.clave]: (ed[p.clave] ?? '') + v }))}
                    className="text-[11px] font-mono bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded hover:bg-violet-100 transition-colors"
                    title="Clic para insertar al final">
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Panel: Localidades ────────────────────────────────────────────────────────

interface Localidad { id: string; nombre: string; activo: boolean; orden: number; }

function PanelLocalidades() {
  const [lista, setLista]     = useState<Localidad[]>([]);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [nuevo, setNuevo]     = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => { reload(); }, []);

  function reload() {
    api.get<Localidad[]>('/localidades').then(setLista).catch(() => {});
  }

  async function guardarNuevo() {
    if (!nuevo.trim()) return;
    setSaving(true);
    try {
      await api.post('/localidades', { nombre: nuevo.trim(), orden: lista.length });
      setNuevo('');
      reload();
      toast.success('Localidad agregada');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  }

  async function guardarEdicion(id: string) {
    if (!editVal.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/localidades/${id}`, { nombre: editVal.trim() });
      setEditId(null);
      reload();
      toast.success('Localidad actualizada');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  }

  async function toggleActivo(loc: Localidad) {
    try {
      await api.patch(`/localidades/${loc.id}`, { activo: !loc.activo });
      reload();
    } catch { toast.error('Error'); }
  }

  async function eliminar(loc: Localidad) {
    try {
      await api.delete(`/localidades/${loc.id}`);
      reload();
      toast.success('Localidad eliminada');
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Error';
      toast.error(msg.includes('uso') ? 'Localidad en uso por clientes' : 'Error al eliminar');
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Lista de localidades disponibles al cargar clientes. Se puede desactivar sin eliminar.
      </p>

      {/* Lista */}
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
        {lista.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Sin localidades</p>
        )}
        {lista.map(loc => (
          <div key={loc.id} className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-gray-50">
            <GripVertical size={14} className="text-gray-300 shrink-0" />
            {editId === loc.id ? (
              <input
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(loc.id); if (e.key === 'Escape') setEditId(null); }}
                className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            ) : (
              <span className={cn('flex-1 text-sm', loc.activo ? 'text-gray-800' : 'text-gray-400 line-through')}>{loc.nombre}</span>
            )}
            <div className="flex items-center gap-1 shrink-0">
              {editId === loc.id ? (
                <>
                  <button onClick={() => guardarEdicion(loc.id)} disabled={saving}
                    className="p-1 rounded hover:bg-emerald-100 text-emerald-600"><Check size={13} /></button>
                  <button onClick={() => setEditId(null)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={13} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(loc.id); setEditVal(loc.nombre); }}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                  <button onClick={() => toggleActivo(loc)}
                    className={cn('p-1 rounded', loc.activo ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:bg-gray-100')}>
                    {loc.activo ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => eliminar(loc)}
                    className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agregar */}
      <div className="flex gap-2">
        <input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && guardarNuevo()}
          placeholder="Nueva localidad..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button onClick={guardarNuevo} disabled={saving || !nuevo.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40">
          <Plus size={14} /> Agregar
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Panel = 'empresa' | 'usuarios' | 'localidades' | 'tipos_abertura' | 'sistemas' | 'colores' | 'mensajes' | null;

const CATALOG_BTNS: { id: Exclude<Panel, 'empresa' | 'usuarios' | 'localidades' | null>; label: string; icon: typeof Layers; desc: string }[] = [
  { id: 'tipos_abertura', label: 'Tipos de abertura', icon: Layers,    desc: 'Ventana, puerta, celosía...' },
  { id: 'sistemas',       label: 'Sistemas',           icon: Settings2, desc: 'Líneas y materiales' },
  { id: 'colores',        label: 'Colores',             icon: Palette,   desc: 'Colores disponibles' },
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
        <div className="px-5 pb-5 pt-2 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}

export function Configuracion() {
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const { user } = useAuth();

  function togglePanel(id: Exclude<Panel, null>) {
    setOpenPanel(prev => (prev === id ? null : id));
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-5xl mx-auto space-y-6" data-section="config">
      <SectionHero
        section="config"
        icon={SlidersHorizontal}
        title="Configuración"
        sub="Ajustes del sistema, catálogo y usuarios"
      />

      {/* General */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General</h2>
        <div className="bg-white rounded-2xl border border-gray-300 shadow-lg overflow-hidden">
          <AccordionItem id="empresa" label="Empresa" icon={Building2} desc="Datos del negocio, CUIT, contacto"
            open={openPanel === 'empresa'} onToggle={() => togglePanel('empresa')}>
            <PanelEmpresa />
          </AccordionItem>
          <div className="border-t border-gray-200" />
          <AccordionItem id="usuarios" label="Usuarios" icon={Users} desc="Accesos y roles del equipo"
            open={openPanel === 'usuarios'} onToggle={() => togglePanel('usuarios')}>
            <PanelUsuarios currentUserId={user?.id ?? ''} />
          </AccordionItem>
          <div className="border-t border-gray-200" />
          <AccordionItem id="localidades" label="Localidades" icon={MapPin} desc="Ciudades y zonas disponibles al cargar clientes"
            open={openPanel === 'localidades'} onToggle={() => togglePanel('localidades')}>
            <PanelLocalidades />
          </AccordionItem>
        </div>
      </div>

      {/* Catálogo de productos */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Catálogo de productos</h2>
        <div className="bg-white rounded-2xl border border-gray-300 shadow-lg overflow-hidden">
          {CATALOG_BTNS.map(({ id, label, icon, desc }, idx) => (
            <div key={id}>
              {idx > 0 && <div className="border-t border-gray-200" />}
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

      {/* Mensajes WhatsApp */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Comunicación</h2>
        <div className="bg-white rounded-2xl border border-gray-300 shadow-lg overflow-hidden">
          <AccordionItem id="mensajes" label="Mensajes WhatsApp" icon={MessageSquare}
            desc="Texto de pedidos, presupuestos y remitos enviados por WhatsApp"
            open={openPanel === 'mensajes'} onToggle={() => togglePanel('mensajes')}>
            <PanelMensajes />
          </AccordionItem>
        </div>
      </div>
    </div>
  );
}
