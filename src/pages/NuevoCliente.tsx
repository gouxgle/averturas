import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { CategoriaCliente } from '@/types';

export function NuevoCliente() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([]);

  const [form, setForm] = useState({
    nombre: searchParams.get('nombre') ?? '',
    apellido: '',
    razon_social: '',
    telefono: '',
    email: '',
    direccion: '',
    localidad: '',
    categoria_id: '',
    notas: '',
  });

  useEffect(() => {
    supabase.from('categorias_cliente').select('*').order('orden').then(({ data }) => {
      setCategorias((data ?? []) as CategoriaCliente[]);
    });
  }, []);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('clientes').insert({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || null,
        razon_social: form.razon_social.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        direccion: form.direccion.trim() || null,
        localidad: form.localidad.trim() || null,
        categoria_id: form.categoria_id || null,
        notas: form.notas.trim() || null,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      toast.success('Cliente creado');
      navigate(`/clientes/${data.id}`);
    } catch {
      toast.error('Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        {...props}
      />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Nuevo cliente</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field('Nombre *', 'nombre', { autoFocus: true, placeholder: 'Juan' })}
          {field('Apellido', 'apellido', { placeholder: 'García' })}
        </div>
        {field('Razón social (si es empresa)', 'razon_social', { placeholder: 'García Construcciones SRL' })}
        <div className="grid grid-cols-2 gap-4">
          {field('Teléfono', 'telefono', { type: 'tel', placeholder: '3704 123456' })}
          {field('Email', 'email', { type: 'email', placeholder: 'juan@email.com' })}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field('Dirección', 'direccion', { placeholder: 'Av. San Martín 123' })}
          {field('Localidad', 'localidad', { placeholder: 'Formosa' })}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
          <select
            value={form.categoria_id}
            onChange={e => set('categoria_id', e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">Sin categoría</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
          <textarea
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            rows={3}
            placeholder="Observaciones sobre el cliente..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar cliente'}
        </button>
      </div>
    </div>
  );
}
