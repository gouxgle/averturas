import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, User, Building2,
  Phone, Mail, MapPin, Tag, FileText, Hash,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CategoriaCliente } from '@/types';

type TipoPersona = 'fisica' | 'juridica';

function useEnterAdvance() {
  function onKey(e: KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return;
    const form = (e.target as HTMLElement).closest('[data-form]');
    if (!form) return;
    const fields = Array.from(
      form.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    );
    const idx = fields.indexOf(e.target as HTMLElement);
    if (idx >= 0 && idx < fields.length - 1) {
      e.preventDefault();
      (fields[idx + 1] as HTMLElement).focus();
    }
  }
  return onKey;
}

export function NuevoCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([]);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const onKey = useEnterAdvance();

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

  function setTipo(tipo: TipoPersona) {
    setForm(prev => ({ ...prev, tipo_persona: tipo, apellido: '', nombre: '', razon_social: '', documento_nro: '' }));
    setTimeout(() => primerCampoRef.current?.focus(), 50);
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
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

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  const SectionHeader = ({ icon: Icon, label, color = 'text-gray-500', bg = 'bg-gray-50' }: {
    icon: React.ElementType; label: string; color?: string; bg?: string;
  }) => (
    <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b border-gray-100', bg)}>
      <Icon size={13} className={color} />
      <span className={cn('text-[11px] font-semibold uppercase tracking-wider', color)}>{label}</span>
    </div>
  );

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4" data-form>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
          <ArrowLeft size={17} className="text-gray-500" />
        </button>

        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <User size={16} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Nuevo cliente</h1>
            <p className="text-[11px] text-gray-400">Enter o Tab para avanzar entre campos</p>
          </div>
        </div>

        {/* Toggle tipo — en el header para no ocupar fila aparte */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button type="button" onClick={() => setTipo('fisica')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              esFisica ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <User size={13} className={esFisica ? 'text-emerald-600' : 'text-gray-400'} />
            Persona física
          </button>
          <button type="button" onClick={() => setTipo('juridica')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              !esFisica ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Building2 size={13} className={!esFisica ? 'text-blue-600' : 'text-gray-400'} />
            Empresa
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => navigate(-1)}
            className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm transition-all">
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Identificación (ancho completo) ── */}
      <div className={cn(
        'bg-white rounded-xl border shadow-sm overflow-hidden',
        esFisica ? 'border-emerald-200' : 'border-blue-200'
      )}>
        <SectionHeader
          icon={esFisica ? User : Building2}
          label={esFisica ? 'Datos personales' : 'Datos de la empresa'}
          color={esFisica ? 'text-emerald-700' : 'text-blue-700'}
          bg={esFisica ? 'bg-emerald-50' : 'bg-blue-50'}
        />
        <div className="p-4">
          {esFisica ? (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4">
                <label className={labelCls}>Apellido *</label>
                <input ref={primerCampoRef} autoFocus value={form.apellido}
                  onChange={e => set('apellido', e.target.value)} onKeyDown={onKey}
                  placeholder="García" className={inputCls} />
              </div>
              <div className="col-span-4">
                <label className={labelCls}>Nombre</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  onKeyDown={onKey} placeholder="Juan" className={inputCls} />
              </div>
              <div className="col-span-4">
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><Hash size={10} />DNI</span>
                </label>
                <input value={form.documento_nro} onChange={e => set('documento_nro', e.target.value)}
                  onKeyDown={onKey} placeholder="12.345.678" className={inputCls} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8">
                <label className={labelCls}>Razón social *</label>
                <input ref={primerCampoRef} autoFocus value={form.razon_social}
                  onChange={e => set('razon_social', e.target.value)} onKeyDown={onKey}
                  placeholder="García Construcciones SRL" className={inputCls} />
              </div>
              <div className="col-span-4">
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><Hash size={10} />CUIT</span>
                </label>
                <input value={form.documento_nro} onChange={e => set('documento_nro', e.target.value)}
                  onKeyDown={onKey} placeholder="20-12345678-9" className={inputCls} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 2: Contacto | Ubicación ── */}
      <div className="grid grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Phone} label="Contacto" />
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                onKeyDown={onKey} type="tel" placeholder="3704 123456" className={inputCls} />
            </div>
            <div>
              <label className={cn(labelCls, 'flex items-center gap-1')}>
                <Mail size={10} />Email
              </label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                onKeyDown={onKey} type="email" placeholder="juan@email.com" className={inputCls} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={MapPin} label="Ubicación" />
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dirección</label>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
                onKeyDown={onKey} placeholder="Av. San Martín 123" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input value={form.localidad} onChange={e => set('localidad', e.target.value)}
                onKeyDown={onKey} placeholder="Formosa" className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Fila 3: Categoría | Notas ── */}
      <div className="grid grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Tag} label="Categoría" />
          <div className="p-4">
            <label className={labelCls}>Tipo de cliente</label>
            <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}
              onKeyDown={onKey} className={inputCls}>
              <option value="">Sin categoría</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={FileText} label="Notas" />
          <div className="p-4">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              rows={2} placeholder="Observaciones sobre el cliente..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>
      </div>

    </div>
  );
}
