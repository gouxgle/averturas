import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, User, Building2, Phone, Mail,
  MapPin, Tag, FileText, CreditCard, Hash,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CategoriaCliente } from '@/types';

type TipoPersona = 'fisica' | 'juridica';

export function NuevoCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([]);

  const [form, setForm] = useState({
    tipo_persona: 'fisica' as TipoPersona,
    apellido: '',
    nombre: searchParams.get('nombre') ?? '',
    razon_social: '',
    documento_nro: '',
    telefono: '',
    email: '',
    direccion: '',
    localidad: '',
    categoria_id: '',
    notas: '',
  });

  useEffect(() => {
    api.get<CategoriaCliente[]>('/catalogo/categorias-cliente').then(setCategorias);
  }, []);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function setTipo(tipo: TipoPersona) {
    setForm(prev => ({ ...prev, tipo_persona: tipo, documento_nro: '', nombre: '', apellido: '', razon_social: '' }));
  }

  async function handleSave() {
    const esFisica = form.tipo_persona === 'fisica';
    if (esFisica && !form.apellido.trim()) { toast.error('El apellido es requerido'); return; }
    if (!esFisica && !form.razon_social.trim()) { toast.error('La razón social es requerida'); return; }
    setSaving(true);
    try {
      const data = await api.post<{ id: string }>('/clientes', form);
      toast.success('Cliente creado');
      navigate(`/clientes/${data.id}`);
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar el cliente');
    } finally {
      setSaving(false);
    }
  }

  const esFisica = form.tipo_persona === 'fisica';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <User size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nuevo cliente</h1>
            <p className="text-xs text-gray-500">Completá los datos del cliente</p>
          </div>
        </div>
      </div>

      {/* Tipo de persona */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tipo de cliente</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTipo('fisica')}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all',
              esFisica
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              esFisica ? 'bg-emerald-500' : 'bg-gray-100')}>
              <User size={18} className={esFisica ? 'text-white' : 'text-gray-400'} />
            </div>
            <div>
              <p className={cn('text-sm font-semibold', esFisica ? 'text-emerald-700' : 'text-gray-600')}>
                Persona física
              </p>
              <p className="text-xs text-gray-400">DNI · Apellido y nombre</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTipo('juridica')}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all',
              !esFisica
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              !esFisica ? 'bg-blue-500' : 'bg-gray-100')}>
              <Building2 size={18} className={!esFisica ? 'text-white' : 'text-gray-400'} />
            </div>
            <div>
              <p className={cn('text-sm font-semibold', !esFisica ? 'text-blue-700' : 'text-gray-600')}>
                Empresa
              </p>
              <p className="text-xs text-gray-400">CUIT · Razón social</p>
            </div>
          </button>
        </div>
      </div>

      {/* Identificación */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className={cn('flex items-center gap-2.5 px-4 py-3 border-b border-gray-100',
          esFisica ? 'bg-emerald-50' : 'bg-blue-50')}>
          {esFisica
            ? <User size={15} className="text-emerald-600" />
            : <Building2 size={15} className="text-blue-600" />}
          <p className={cn('text-xs font-semibold uppercase tracking-wider',
            esFisica ? 'text-emerald-700' : 'text-blue-700')}>
            {esFisica ? 'Datos personales' : 'Datos de la empresa'}
          </p>
        </div>
        <div className="p-4 space-y-4">
          {esFisica ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Apellido *</label>
                <input
                  value={form.apellido}
                  onChange={e => set('apellido', e.target.value)}
                  autoFocus
                  placeholder="García"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  placeholder="Juan"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Razón social *</label>
              <input
                value={form.razon_social}
                onChange={e => set('razon_social', e.target.value)}
                autoFocus
                placeholder="García Construcciones SRL"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Hash size={11} />
              {esFisica ? 'DNI' : 'CUIT'}
            </label>
            <input
              value={form.documento_nro}
              onChange={e => set('documento_nro', e.target.value)}
              placeholder={esFisica ? '12.345.678' : '20-12345678-9'}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <Phone size={15} className="text-gray-500" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Phone size={11} /> Teléfono
              </label>
              <input
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                type="tel"
                placeholder="3704 123456"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Mail size={11} /> Email
              </label>
              <input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                type="email"
                placeholder="juan@email.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ubicación */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <MapPin size={15} className="text-gray-500" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ubicación</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Dirección</label>
              <input
                value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
                placeholder="Av. San Martín 123"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Localidad</label>
              <input
                value={form.localidad}
                onChange={e => set('localidad', e.target.value)}
                placeholder="Formosa"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Categoría y notas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <Tag size={15} className="text-gray-500" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría y notas</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <CreditCard size={11} /> Categoría
            </label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <FileText size={11} /> Notas
            </label>
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              rows={3}
              placeholder="Observaciones sobre el cliente..."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3 pb-2">
        <button onClick={() => navigate(-1)}
          className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium shadow-sm transition-all">
          <Save size={15} />
          {saving ? 'Guardando...' : 'Guardar cliente'}
        </button>
      </div>
    </div>
  );
}
