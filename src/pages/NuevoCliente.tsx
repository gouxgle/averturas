import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, User, Building2,
  Phone, Mail, MapPin, Tag, FileText, Hash, Calendar, Heart, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CategoriaCliente, Cliente } from '@/types';

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

function titleCase(str: string) {
  return str.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

const emptyForm = (nombre = '') => ({
  tipo_persona:         'fisica' as TipoPersona,
  apellido:             '',
  nombre,
  razon_social:         '',
  documento_nro:        '',
  fecha_nacimiento:     '',
  genero:               '',
  telefono:             '',
  telefono_fijo:        '',
  email:                '',
  direccion:            '',
  localidad:            '',
  dom_obra:             '',
  dom_obra_localidad:   '',
  categoria_id:         '',
  estado:               'activo',
  origen:               '',
  preferencia_contacto: '',
  acepta_marketing:     true as boolean,
  referido_por_id:      '',
  notas:                '',
});

export function NuevoCliente() {
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit      = Boolean(editId);

  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(isEdit);
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([]);
  const [clientesRef, setClientesRef] = useState<Cliente[]>([]);
  const [dniWarning, setDniWarning]   = useState<string | null>(null);
  const primerCampoRef = useRef<HTMLInputElement>(null);
  const onKey = useEnterAdvance();

  const [form, setForm] = useState(emptyForm(searchParams.get('nombre') ?? ''));

  useEffect(() => {
    const proms: Promise<unknown>[] = [
      api.get<CategoriaCliente[]>('/catalogo/categorias-cliente').then(setCategorias),
      api.get<Cliente[]>('/clientes').then(setClientesRef),
    ];
    if (isEdit) {
      proms.push(
        api.get<Cliente>(`/clientes/${editId}`).then(c => {
          setForm({
            tipo_persona:         c.tipo_persona,
            apellido:             c.apellido          ?? '',
            nombre:               c.nombre            ?? '',
            razon_social:         c.razon_social      ?? '',
            documento_nro:        c.documento_nro     ?? '',
            fecha_nacimiento:     c.fecha_nacimiento  ?? '',
            genero:               c.genero            ?? '',
            telefono:             c.telefono          ?? '',
            telefono_fijo:        c.telefono_fijo     ?? '',
            email:                c.email             ?? '',
            direccion:            c.direccion         ?? '',
            localidad:            c.localidad         ?? '',
            dom_obra:             c.dom_obra          ?? '',
            dom_obra_localidad:   c.dom_obra_localidad ?? '',
            categoria_id:         c.categoria_id      ?? '',
            estado:               c.estado,
            origen:               c.origen            ?? '',
            preferencia_contacto: c.preferencia_contacto ?? '',
            acepta_marketing:     c.acepta_marketing,
            referido_por_id:      c.referido_por_id   ?? '',
            notas:                c.notas             ?? '',
          });
          setLoading(false);
        })
      );
    }
    Promise.all(proms);
  }, [editId, isEdit]);

  function setTipo(tipo: TipoPersona) {
    setForm(prev => ({ ...prev, tipo_persona: tipo, apellido: '', nombre: '', razon_social: '', documento_nro: '', fecha_nacimiento: '', genero: '' }));
    setDniWarning(null);
    setTimeout(() => primerCampoRef.current?.focus(), 50);
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function applyTitleCase(field: 'apellido' | 'nombre' | 'razon_social') {
    setForm(prev => ({ ...prev, [field]: titleCase(prev[field]) }));
  }

  async function checkDni(dni: string) {
    const clean = dni.replace(/\D/g, '');
    if (!clean || clean.length < 6) { setDniWarning(null); return; }
    try {
      const res = await api.get<{ existe: boolean; cliente: { nombre: string | null; apellido: string | null; razon_social: string | null } | null }>(
        `/clientes/validar-dni?dni=${encodeURIComponent(clean)}${isEdit ? `&excluir_id=${editId}` : ''}`
      );
      if (res.existe && res.cliente) {
        const nombre = res.cliente.razon_social ?? [res.cliente.apellido, res.cliente.nombre].filter(Boolean).join(', ');
        setDniWarning(`Ya existe: ${nombre}`);
      } else {
        setDniWarning(null);
      }
    } catch { setDniWarning(null); }
  }

  async function handleSave() {
    const esFisica = form.tipo_persona === 'fisica';
    if (esFisica && !form.apellido.trim()) { toast.error('El apellido es requerido'); return; }
    if (!esFisica && !form.razon_social.trim()) { toast.error('La razón social es requerida'); return; }

    // Re-validar DNI en el momento de guardar (no solo on-blur)
    const dniClean = form.documento_nro.replace(/\D/g, '');
    if (dniClean.length >= 6) {
      try {
        const res = await api.get<{ existe: boolean; cliente: { nombre: string | null; apellido: string | null; razon_social: string | null } | null }>(
          `/clientes/validar-dni?dni=${encodeURIComponent(dniClean)}${isEdit ? `&excluir_id=${editId}` : ''}`
        );
        if (res.existe && res.cliente) {
          const nombre = res.cliente.razon_social ?? [res.cliente.apellido, res.cliente.nombre].filter(Boolean).join(', ');
          toast.error(`DNI/CUIT ya registrado: ${nombre}`);
          setDniWarning(`Ya existe: ${nombre}`);
          return;
        }
      } catch { /* red error — dejamos pasar */ }
    }

    setSaving(true);
    const payload = {
      ...form,
      apellido:     titleCase(form.apellido),
      nombre:       titleCase(form.nombre),
      razon_social: titleCase(form.razon_social),
      documento_nro: form.documento_nro.replace(/\D/g, '') || null,
    };
    try {
      if (isEdit) {
        await api.put(`/clientes/${editId}`, payload);
        toast.success('Cliente actualizado');
        navigate(`/clientes/${editId}`);
      } else {
        const data = await api.post<{ id: string }>('/clientes', payload);
        toast.success('Cliente creado');
        navigate(`/clientes/${data.id}`);
      }
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const esFisica = form.tipo_persona === 'fisica';

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  const SectionHeader = ({ icon: Icon, label, color = 'text-gray-500', bg = 'bg-gray-50' }: {
    icon: React.ElementType; label: string; color?: string; bg?: string;
  }) => (
    <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b border-gray-100', bg)}>
      <Icon size={13} className={color} />
      <span className={cn('text-[11px] font-semibold uppercase tracking-wider', color)}>{label}</span>
    </div>
  );

  if (loading) return (
    <div className="p-6 text-sm text-gray-400">Cargando...</div>
  );

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4" data-form>

      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <ArrowLeft size={17} className="text-gray-500" />
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <User size={16} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight">
                {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
              </h1>
              <p className="text-[11px] text-gray-400 hidden sm:block">Enter o Tab para avanzar entre campos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => navigate(-1)}
              className="hidden sm:block px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm transition-all">
              <Save size={14} />
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
        {/* Toggle tipo — solo en alta */}
        {!isEdit && (
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start">
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
        )}
      </div>

      {/* ── Identificación ── */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Apellido *</label>
                <input ref={primerCampoRef} autoFocus={!isEdit} value={form.apellido}
                  onChange={e => set('apellido', e.target.value)}
                  onBlur={() => applyTitleCase('apellido')}
                  onKeyDown={onKey}
                  placeholder="García" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nombre</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  onBlur={() => applyTitleCase('nombre')}
                  onKeyDown={onKey} placeholder="Juan" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><Hash size={10} />DNI</span>
                </label>
                <input value={form.documento_nro}
                  onChange={e => { set('documento_nro', e.target.value); setDniWarning(null); }}
                  onBlur={e => checkDni(e.target.value)}
                  onKeyDown={onKey} placeholder="12345678"
                  className={cn(inputCls, dniWarning && 'border-amber-400 focus:ring-amber-400')} />
                {dniWarning && (
                  <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                    <AlertCircle size={11} /> {dniWarning}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><Calendar size={10} />Fecha de nacimiento</span>
                </label>
                <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)}
                  onKeyDown={onKey} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Género</label>
                <select value={form.genero} onChange={e => set('genero', e.target.value)}
                  onKeyDown={onKey} className={inputCls}>
                  <option value="">—</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>Razón social *</label>
                <input ref={primerCampoRef} autoFocus={!isEdit} value={form.razon_social}
                  onChange={e => set('razon_social', e.target.value)}
                  onBlur={() => applyTitleCase('razon_social')}
                  onKeyDown={onKey}
                  placeholder="García Construcciones SRL" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1"><Hash size={10} />CUIT</span>
                </label>
                <input value={form.documento_nro}
                  onChange={e => { set('documento_nro', e.target.value); setDniWarning(null); }}
                  onBlur={e => checkDni(e.target.value)}
                  onKeyDown={onKey} placeholder="20-12345678-9"
                  className={cn(inputCls, dniWarning && 'border-amber-400 focus:ring-amber-400')} />
                {dniWarning && (
                  <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                    <AlertCircle size={11} /> {dniWarning}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Contacto | Ubicación ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Phone} label="Contacto" />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className={cn(labelCls, 'flex items-center gap-1')}><Phone size={10} />Celular / WhatsApp</label>
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                onKeyDown={onKey} type="tel" placeholder="3704 123456" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tel. fijo (opcional)</label>
              <input value={form.telefono_fijo} onChange={e => set('telefono_fijo', e.target.value)}
                onKeyDown={onKey} type="tel" placeholder="3717 123456" className={inputCls} />
            </div>
            <div>
              <label className={cn(labelCls, 'flex items-center gap-1')}><Mail size={10} />Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                onKeyDown={onKey} type="email" placeholder="juan@email.com" className={inputCls} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={MapPin} label="Domicilios" />
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Domicilio particular</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
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
            <div className="border-t border-gray-100 pt-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Domicilio de obra <span className="normal-case font-normal">(opcional)</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className={labelCls}>Dirección obra</label>
                  <input value={form.dom_obra} onChange={e => set('dom_obra', e.target.value)}
                    onKeyDown={onKey} placeholder="Calle Los Álamos 456" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Localidad obra</label>
                  <input value={form.dom_obra_localidad} onChange={e => set('dom_obra_localidad', e.target.value)}
                    onKeyDown={onKey} placeholder="Formosa" className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Clasificación | Notas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Tag} label="Clasificación" />
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => set('estado', e.target.value)}
                  onKeyDown={onKey} className={inputCls}>
                  <option value="prospecto">Prospecto</option>
                  <option value="activo">Activo</option>
                  <option value="recurrente">Recurrente</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Categoría</label>
                <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}
                  onKeyDown={onKey} className={inputCls}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Origen</label>
                <select value={form.origen} onChange={e => set('origen', e.target.value)}
                  onKeyDown={onKey} className={inputCls}>
                  <option value="">—</option>
                  <option value="recomendacion">Recomendación</option>
                  <option value="redes">Redes sociales</option>
                  <option value="web">Web / Google</option>
                  <option value="visita">Visita directa</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-gray-100 items-end">
              <div>
                <label className={cn(labelCls, 'flex items-center gap-1')}><Heart size={10} />Preferencia contacto</label>
                <select value={form.preferencia_contacto} onChange={e => set('preferencia_contacto', e.target.value)}
                  onKeyDown={onKey} className={inputCls}>
                  <option value="">—</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="llamada">Llamada</option>
                  <option value="email">Email</option>
                  <option value="visita">Visita</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Referido por</label>
                <select value={form.referido_por_id} onChange={e => set('referido_por_id', e.target.value)}
                  onKeyDown={onKey} className={inputCls}>
                  <option value="">—</option>
                  {clientesRef
                    .filter(c => c.id !== editId)
                    .map(c => {
                      const label = c.tipo_persona === 'juridica'
                        ? c.razon_social
                        : [c.apellido, c.nombre].filter(Boolean).join(', ');
                      return <option key={c.id} value={c.id}>{label}</option>;
                    })}
                </select>
              </div>
              <div>
                <label className={labelCls}>Marketing</label>
                <label className="flex items-center gap-2 cursor-pointer h-[36px]">
                  <input type="checkbox" checked={form.acepta_marketing}
                    onChange={e => setForm(prev => ({ ...prev, acepta_marketing: e.target.checked }))}
                    className="w-4 h-4 rounded accent-emerald-600" />
                  <span className="text-sm text-gray-600">Acepta comunicaciones</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={FileText} label="Notas" />
          <div className="p-4">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              rows={2} placeholder="Observaciones sobre el cliente..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
        </div>
      </div>

    </div>
  );
}
