import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft, Zap, Clock, User, Building2, MapPin, Phone, Mail,
  Tag, FileText, Hash, Calendar, AlertCircle, Home, Briefcase,
  MessageCircle, ChevronRight, Star, Lightbulb,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CategoriaCliente, Cliente } from '@/types';

type TipoPersona = 'fisica' | 'juridica';

function titleCase(str: string) {
  return str.trim().replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Combina apellido + nombre para el campo rápido
function combinarNombre(apellido: string | null, nombre: string | null) {
  return [apellido, nombre].filter(Boolean).join(' ');
}

// Separa "Lopez Diego Andino" → apellido="Lopez", nombre="Diego Andino"
function separarNombre(completo: string): { apellido: string; nombre: string } {
  const parts = completo.trim().split(/\s+/);
  if (parts.length === 1) return { apellido: parts[0], nombre: '' };
  const apellido = parts[0];
  const nombre   = parts.slice(1).join(' ');
  return { apellido, nombre };
}

const emptyForm = () => ({
  tipo_persona:              'fisica' as TipoPersona,
  apellido:                  '',
  nombre:                    '',
  razon_social:              '',
  // Rápidos
  telefono:                  '',
  localidad:                 '',
  origen:                    '',
  notas:                     '',
  // Datos personales
  documento_nro:             '',
  email:                     '',
  fecha_nacimiento:          '',
  genero:                    '',
  estado_civil:              '',
  // Contacto complementario
  telefono_fijo:             '',
  email_alternativo:         '',
  preferencia_contacto:      '',
  acepta_marketing:          true as boolean,
  // Domicilio principal
  direccion:                 '',
  codigo_postal:             '',
  // Domicilio obra
  dom_obra:                  '',
  dom_obra_localidad:        '',
  // Segundo domicilio
  dom_alternativo:           '',
  dom_alternativo_localidad: '',
  dom_alternativo_cp:        '',
  dom_alternativo_referencia:'',
  // Clasificación
  estado:                    'activo',
  categoria_id:              '',
  referido_por_id:           '',
  // Admin
  condicion_iva:             '',
  // CRM
  crm_etapa:                 '',
  interes:                   '',
});

type FormState = ReturnType<typeof emptyForm>;

export function NuevoCliente() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id?: string }>();
  const isEdit = Boolean(editId);

  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(isEdit);
  const [categorias, setCategorias] = useState<CategoriaCliente[]>([]);
  const [clientesRef, setClientesRef] = useState<Cliente[]>([]);
  const [dniWarning, setDniWarning]   = useState<string | null>(null);
  const [obraEsMisma, setObraEsMisma] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => {
    const f = emptyForm();
    const n = searchParams.get('nombre');
    if (n) f.apellido = n;
    return f;
  });

  // nombre_completo para el campo rápido
  const [nombreCompleto, setNombreCompleto] = useState(
    combinarNombre(form.apellido, form.nombre)
  );

  useEffect(() => {
    api.get<CategoriaCliente[]>('/catalogo/categorias-cliente').then(setCategorias);
    api.get<Cliente[]>('/clientes').then(setClientesRef);

    if (isEdit) {
      api.get<Cliente>(`/clientes/${editId}`).then(c => {
        const f: FormState = {
          tipo_persona:              c.tipo_persona,
          apellido:                  c.apellido              ?? '',
          nombre:                    c.nombre                ?? '',
          razon_social:              c.razon_social          ?? '',
          telefono:                  c.telefono              ?? '',
          localidad:                 c.localidad             ?? '',
          origen:                    c.origen                ?? '',
          notas:                     c.notas                 ?? '',
          documento_nro:             c.documento_nro         ?? '',
          email:                     c.email                 ?? '',
          fecha_nacimiento:          c.fecha_nacimiento      ?? '',
          genero:                    c.genero                ?? '',
          estado_civil:              c.estado_civil          ?? '',
          telefono_fijo:             c.telefono_fijo         ?? '',
          email_alternativo:         c.email_alternativo     ?? '',
          preferencia_contacto:      c.preferencia_contacto  ?? '',
          acepta_marketing:          c.acepta_marketing,
          direccion:                 c.direccion             ?? '',
          codigo_postal:             c.codigo_postal         ?? '',
          dom_obra:                  c.dom_obra              ?? '',
          dom_obra_localidad:        c.dom_obra_localidad    ?? '',
          dom_alternativo:           c.dom_alternativo       ?? '',
          dom_alternativo_localidad: c.dom_alternativo_localidad ?? '',
          dom_alternativo_cp:        c.dom_alternativo_cp    ?? '',
          dom_alternativo_referencia:c.dom_alternativo_referencia ?? '',
          estado:                    c.estado,
          categoria_id:              c.categoria_id          ?? '',
          referido_por_id:           c.referido_por_id       ?? '',
          condicion_iva:             c.condicion_iva         ?? '',
          crm_etapa:                 (c as any).crm_etapa    ?? '',
          interes:                   (c as any).interes      ?? '',
        };
        setForm(f);
        setNombreCompleto(
          c.tipo_persona === 'fisica'
            ? combinarNombre(c.apellido, c.nombre)
            : (c.razon_social ?? '')
        );
        setLoading(false);
      });
    }
  }, [editId, isEdit]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function setTipo(tipo: TipoPersona) {
    setForm(prev => ({ ...prev, tipo_persona: tipo }));
    setNombreCompleto('');
    setDniWarning(null);
    setTimeout(() => nombreRef.current?.focus(), 50);
  }

  async function checkDni(dni: string) {
    const clean = dni.replace(/\D/g, '');
    if (!clean || clean.length < 6) { setDniWarning(null); return; }
    try {
      const res = await api.get<{ existe: boolean; cliente: { nombre: string | null; apellido: string | null; razon_social: string | null } | null }>(
        `/clientes/validar-dni?dni=${encodeURIComponent(clean)}${isEdit ? `&excluir_id=${editId}` : ''}`
      );
      if (res.existe && res.cliente) {
        const n = res.cliente.razon_social ?? [res.cliente.apellido, res.cliente.nombre].filter(Boolean).join(', ');
        setDniWarning(`Ya existe: ${n}`);
      } else {
        setDniWarning(null);
      }
    } catch { setDniWarning(null); }
  }

  function buildPayload() {
    const esFisica = form.tipo_persona === 'fisica';
    const { apellido, nombre } = esFisica
      ? separarNombre(nombreCompleto)
      : { apellido: '', nombre: '' };

    return {
      ...form,
      apellido:     esFisica ? titleCase(apellido) : null,
      nombre:       esFisica ? (titleCase(nombre) || titleCase(apellido)) : null,
      razon_social: !esFisica ? titleCase(nombreCompleto) : null,
      documento_nro: form.documento_nro.replace(/\D/g, '') || null,
      dom_obra:             obraEsMisma ? form.direccion    : (form.dom_obra      || null),
      dom_obra_localidad:   obraEsMisma ? form.localidad    : (form.dom_obra_localidad || null),
    };
  }

  async function doSave(afterSave?: (id: string) => void) {
    const esFisica = form.tipo_persona === 'fisica';
    if (!nombreCompleto.trim()) {
      toast.error(esFisica ? 'El nombre es requerido' : 'La razón social es requerida');
      return;
    }
    if (!form.telefono.trim()) { toast.error('El WhatsApp / celular es requerido'); return; }

    // Re-validar DNI
    const dniClean = form.documento_nro.replace(/\D/g, '');
    if (dniClean.length >= 6) {
      try {
        const res = await api.get<{ existe: boolean; cliente: { nombre: string | null; apellido: string | null; razon_social: string | null } | null }>(
          `/clientes/validar-dni?dni=${encodeURIComponent(dniClean)}${isEdit ? `&excluir_id=${editId}` : ''}`
        );
        if (res.existe && res.cliente) {
          const n = res.cliente.razon_social ?? [res.cliente.apellido, res.cliente.nombre].filter(Boolean).join(', ');
          toast.error(`DNI/CUIT ya registrado: ${n}`);
          setDniWarning(`Ya existe: ${n}`);
          return;
        }
      } catch { /* pasar */ }
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      let clienteId: string;
      if (isEdit) {
        await api.put(`/clientes/${editId}`, payload);
        toast.success('Cliente actualizado');
        clienteId = editId!;
      } else {
        const data = await api.post<{ id: string }>('/clientes', payload);
        toast.success('Cliente creado');
        clienteId = data.id;
      }
      if (afterSave) afterSave(clienteId);
      else navigate(`/clientes/${clienteId}`);
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // Calcular completitud del perfil
  const completionFields = [
    form.documento_nro, form.email, form.fecha_nacimiento, form.genero, form.estado_civil,
    form.telefono_fijo, form.email_alternativo, form.direccion, form.codigo_postal,
    form.dom_obra, form.dom_alternativo, form.categoria_id, form.condicion_iva,
    form.notas, form.referido_por_id,
  ];
  const quickFilled = [nombreCompleto, form.telefono, form.localidad].filter(Boolean).length;
  const compFilled  = completionFields.filter(Boolean).length;
  const completion  = Math.round((quickFilled * 7 + compFilled * 4) / (3 * 7 + 15 * 4) * 100);

  const esFisica = form.tipo_persona === 'fisica';

  const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white placeholder-gray-300';
  const lbl = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  const SubHeader = ({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) => (
    <div className={cn('flex items-center gap-2 mb-3', color)}>
      <Icon size={13} />
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={17} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <User size={16} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">
              {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
            </h1>
            <p className="text-[11px] text-gray-400">
              {isEdit ? 'Actualizá los datos del cliente' : 'Cargá los datos básicos para avanzar'}
            </p>
          </div>
        </div>
        <button onClick={() => navigate(-1)}
          className="hidden sm:block px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-5 flex gap-5">
        {/* ── Contenido principal ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ══ SECCIÓN 1: CARGA RÁPIDA ════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header sección */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Zap size={17} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">1. CARGA RÁPIDA  <span className="text-gray-400 font-normal">(Datos iniciales)</span></div>
                  <div className="text-[11px] text-gray-400">Solo pedimos lo esencial para crear el cliente y avanzar.</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Obligatorios
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Nombre + WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>
                    {esFisica ? 'Apellido y nombre *' : 'Razón social / Empresa *'}
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      ref={nombreRef}
                      autoFocus={!isEdit}
                      value={nombreCompleto}
                      onChange={e => setNombreCompleto(e.target.value)}
                      placeholder={esFisica ? 'Ej: López Diego Andrés' : 'Ej: García Construcciones SRL'}
                      className={cn(inp, 'pl-9')}
                    />
                  </div>
                </div>
                <div>
                  <label className={lbl}>WhatsApp / Celular *</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={e => set('telefono', e.target.value)}
                      placeholder="Ej: 3704 123456"
                      className={cn(inp, 'pl-9')}
                    />
                  </div>
                </div>
              </div>

              {/* Tipo de cliente */}
              <div>
                <label className={lbl}>Tipo de cliente *</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTipo('fisica')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                      esFisica
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    )}>
                    <User size={14} className={esFisica ? 'text-emerald-600' : 'text-gray-400'} />
                    Persona física
                  </button>
                  <button type="button" onClick={() => setTipo('juridica')}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                      !esFisica
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    )}>
                    <Building2 size={14} className={!esFisica ? 'text-blue-600' : 'text-gray-400'} />
                    Empresa
                  </button>
                </div>
              </div>

              {/* Localidad + Origen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Localidad *</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                      value={form.localidad}
                      onChange={e => set('localidad', e.target.value)}
                      placeholder="Ej: Formosa"
                      className={cn(inp, 'pl-9')}
                    />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Origen del contacto</label>
                  <select value={form.origen} onChange={e => set('origen', e.target.value)} className={inp}>
                    <option value="">Seleccionar origen</option>
                    <option value="recomendacion">Recomendación</option>
                    <option value="redes">Redes sociales</option>
                    <option value="web">Web / Google</option>
                    <option value="visita">Visita directa</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Observación rápida */}
              <div>
                <label className={lbl}>Observación rápida <span className="normal-case text-gray-300 font-normal">(opcional)</span></label>
                <div className="relative">
                  <MessageCircle size={14} className="absolute left-3 top-3 text-gray-300" />
                  <textarea
                    value={form.notas}
                    onChange={e => set('notas', e.target.value)}
                    rows={2}
                    placeholder="Ej: Cliente nuevo que consultó por ventanas."
                    className={cn(inp, 'pl-9 resize-none')}
                  />
                </div>
              </div>

              {/* Banner verde */}
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <span className="text-xl">🤝</span>
                <div className="text-[12px] text-emerald-700 leading-snug">
                  <span className="font-bold">Con estos datos ya podemos crear el cliente.</span><br />
                  Luego podrás completar el resto cuando sea necesario.
                </div>
              </div>

              {/* Botones CTA */}
              {!isEdit ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => doSave()}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-emerald-500 text-emerald-700 font-bold text-sm hover:bg-emerald-50 transition-all disabled:opacity-60">
                    <span className="text-lg">💾</span>
                    <div className="text-left">
                      <div className="text-sm font-bold">SOLO GUARDAR</div>
                      <div className="text-[11px] font-normal text-emerald-600">Guarda los datos y sigo después</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => doSave(id => navigate(`/presupuestos/nuevo?cliente_id=${id}`))}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60">
                    <span className="text-lg">📋</span>
                    <div className="text-left">
                      <div className="text-sm font-bold">GUARDAR Y PASAR A PROFORMA</div>
                      <div className="text-[11px] font-normal text-emerald-200">Guarda y continúa con la cotización</div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button type="button" onClick={() => doSave()} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow disabled:opacity-60">
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}

              {/* ¿Qué pasa después? */}
              {!isEdit && (
                <div className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <ChevronRight size={15} className="text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-gray-700 mb-0.5">¿Qué pasa después?</div>
                    <div className="text-[11px] text-gray-400 leading-snug">
                      Si elegís "Guardar y pasar a proforma", se abrirá la pantalla de cotización para que cargues los productos y generes la proforma.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══ SECCIÓN 2: DATOS COMPLEMENTARIOS ══════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header sección */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock size={17} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">2. DATOS COMPLEMENTARIOS  <span className="text-gray-400 font-normal">(Opcional)</span></div>
                  <div className="text-[11px] text-gray-400">Completá estos datos más adelante desde la ficha del cliente.</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                Opcionales
              </span>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Columna izquierda ── */}
                <div className="space-y-5">

                  {/* DATOS PERSONALES */}
                  <div>
                    <SubHeader icon={User} label="Datos personales" color="text-blue-600" />
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={lbl}>{esFisica ? 'DNI' : 'CUIT / CUIL'}</label>
                          <input
                            value={form.documento_nro}
                            onChange={e => { set('documento_nro', e.target.value); setDniWarning(null); }}
                            onBlur={e => checkDni(e.target.value)}
                            placeholder={esFisica ? 'Ej: 12345678' : 'Ej: 20-12345678-9'}
                            className={cn(inp, dniWarning && 'border-amber-400 focus:ring-amber-400')}
                          />
                          {dniWarning && (
                            <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                              <AlertCircle size={10} /> {dniWarning}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={lbl}>Correo electrónico</label>
                          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                            placeholder="Ej: juan@email.com" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Fecha de nacimiento</label>
                          <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)}
                            className={inp} />
                        </div>
                      </div>
                      {esFisica && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={lbl}>Género</label>
                            <select value={form.genero} onChange={e => set('genero', e.target.value)} className={inp}>
                              <option value="">Seleccionar</option>
                              <option value="masculino">Masculino</option>
                              <option value="femenino">Femenino</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Estado civil</label>
                            <select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)} className={inp}>
                              <option value="">Seleccionar</option>
                              <option value="soltero">Soltero/a</option>
                              <option value="casado">Casado/a</option>
                              <option value="divorciado">Divorciado/a</option>
                              <option value="viudo">Viudo/a</option>
                              <option value="union_convivencial">Unión convivencial</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DOMICILIO PRINCIPAL */}
                  <div>
                    <SubHeader icon={Home} label="Domicilio principal" color="text-blue-600" />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className={lbl}>Dirección particular</label>
                        <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
                          placeholder="Ej: Av. San Martín 123" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Localidad</label>
                        <input value={form.localidad} onChange={e => set('localidad', e.target.value)}
                          placeholder="Ej: Formosa" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Código postal</label>
                        <input value={form.codigo_postal} onChange={e => set('codigo_postal', e.target.value)}
                          placeholder="Ej: 3600" className={inp} />
                      </div>
                    </div>
                  </div>

                  {/* SEGUNDO DOMICILIO */}
                  <div>
                    <SubHeader icon={Home} label={<>Segundo domicilio / Alternativo <span className="text-gray-400 normal-case font-normal">(Opcional)</span></>  as unknown as string} color="text-blue-600" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={lbl}>Dirección</label>
                        <input value={form.dom_alternativo} onChange={e => set('dom_alternativo', e.target.value)}
                          placeholder="Ej: Ruta 11 km 1" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Localidad</label>
                        <input value={form.dom_alternativo_localidad} onChange={e => set('dom_alternativo_localidad', e.target.value)}
                          placeholder="Ej: Formosa" className={inp} />
                      </div>
                      <div>
                        <label className={lbl}>Código postal</label>
                        <input value={form.dom_alternativo_cp} onChange={e => set('dom_alternativo_cp', e.target.value)}
                          placeholder="Ej: 3600" className={inp} />
                      </div>
                      <div className="col-span-2">
                        <label className={lbl}>Referencia</label>
                        <input value={form.dom_alternativo_referencia} onChange={e => set('dom_alternativo_referencia', e.target.value)}
                          placeholder="Ej: Frente a la estación" className={inp} />
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── Columna derecha ── */}
                <div className="space-y-5">

                  {/* CONTACTO */}
                  <div>
                    <SubHeader icon={Phone} label="Contacto" color="text-blue-600" />
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={lbl}>Tel. fijo (opcional)</label>
                          <input type="tel" value={form.telefono_fijo} onChange={e => set('telefono_fijo', e.target.value)}
                            placeholder="Ej: 3717 123456" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Email alternativo</label>
                          <input type="email" value={form.email_alternativo} onChange={e => set('email_alternativo', e.target.value)}
                            placeholder="Ej: juan@gmail.com" className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>Contacto preferido</label>
                          <select value={form.preferencia_contacto} onChange={e => set('preferencia_contacto', e.target.value)} className={inp}>
                            <option value="">Seleccionar</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="llamada">Llamada</option>
                            <option value="email">Email</option>
                            <option value="visita">Visita</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={lbl}>Acepta comunicaciones / Publicidad</label>
                        <select
                          value={form.acepta_marketing ? 'si' : 'no'}
                          onChange={e => set('acepta_marketing', e.target.value === 'si')}
                          className={inp}>
                          <option value="si">Sí</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* DOMICILIO DE OBRA */}
                  <div>
                    <SubHeader icon={Briefcase} label={<>Domicilio de obra <span className="text-gray-400 normal-case font-normal">(Opcional)</span></> as unknown as string} color="text-blue-600" />
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Dirección de obra</label>
                          <input
                            value={obraEsMisma ? form.direccion : form.dom_obra}
                            onChange={e => set('dom_obra', e.target.value)}
                            disabled={obraEsMisma}
                            placeholder="Ej: Calle Los Álamos 456"
                            className={cn(inp, obraEsMisma && 'opacity-50 bg-gray-50')}
                          />
                        </div>
                        <div>
                          <label className={lbl}>Localidad obra</label>
                          <input
                            value={obraEsMisma ? form.localidad : form.dom_obra_localidad}
                            onChange={e => set('dom_obra_localidad', e.target.value)}
                            disabled={obraEsMisma}
                            placeholder="Ej: Formosa"
                            className={cn(inp, obraEsMisma && 'opacity-50 bg-gray-50')}
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={obraEsMisma}
                          onChange={e => setObraEsMisma(e.target.checked)}
                          className="w-4 h-4 rounded accent-emerald-600"
                        />
                        <span className="text-[12px] text-gray-500">Es la misma dirección que el domicilio principal</span>
                      </label>
                    </div>
                  </div>

                  {/* CLASIFICACIÓN */}
                  <div>
                    <SubHeader icon={Tag} label="Clasificación" color="text-blue-600" />
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={lbl}>Estado</label>
                          <select value={form.estado} onChange={e => set('estado', e.target.value)} className={inp}>
                            <option value="activo">Activo</option>
                            <option value="prospecto">Prospecto</option>
                            <option value="recurrente">Recurrente</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="perdido">Perdido</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Categoría</label>
                          <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)} className={inp}>
                            <option value="">Particular</option>
                            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Origen / Referido por</label>
                          <select value={form.origen} onChange={e => set('origen', e.target.value)} className={inp}>
                            <option value="">Seleccionar</option>
                            <option value="recomendacion">Recomendada</option>
                            <option value="redes">Redes sociales</option>
                            <option value="web">Web / Google</option>
                            <option value="visita">Visita directa</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={lbl}>Preferencia de contacto</label>
                          <select value={form.preferencia_contacto} onChange={e => set('preferencia_contacto', e.target.value)} className={inp}>
                            <option value="">WhatsApp</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="llamada">Llamada</option>
                            <option value="email">Email</option>
                            <option value="visita">Visita</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Referido por</label>
                          <select value={form.referido_por_id} onChange={e => set('referido_por_id', e.target.value)} className={inp}>
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
                          <label className={lbl}>Acepta comunicaciones</label>
                          <select
                            value={form.acepta_marketing ? 'si' : 'no'}
                            onChange={e => set('acepta_marketing', e.target.value === 'si')}
                            className={inp}>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CRM */}
                  <div>
                    <SubHeader icon={Lightbulb} label="Clasificación CRM" color="text-purple-600" />
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>Etapa CRM</label>
                          <select value={form.crm_etapa} onChange={e => set('crm_etapa', e.target.value)} className={inp}>
                            <option value="">Sin asignar</option>
                            <option value="nuevo">Nuevo lead</option>
                            <option value="presupuestado">Presupuestado</option>
                            <option value="en_decision">En decisión</option>
                            <option value="cerrado_ganado">Cerrado - Ganado</option>
                            <option value="cerrado_perdido">Cerrado - Perdido</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Interés / Motivo de contacto</label>
                          <input value={form.interes} onChange={e => set('interes', e.target.value)}
                            placeholder="Ej: Ventanas PVC, Puerta de entrada..."
                            className={inp} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DATOS ADMINISTRATIVOS */}
                  <div>
                    <SubHeader icon={FileText} label="Datos administrativos" color="text-blue-600" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>CUIT / CUIL (opcional)</label>
                        <input
                          value={form.documento_nro}
                          onChange={e => { set('documento_nro', e.target.value); setDniWarning(null); }}
                          onBlur={e => checkDni(e.target.value)}
                          placeholder="Ej: 20-12345678-1"
                          className={cn(inp, dniWarning && 'border-amber-400')}
                        />
                      </div>
                      <div>
                        <label className={lbl}>Condición frente al IVA</label>
                        <select value={form.condicion_iva} onChange={e => set('condicion_iva', e.target.value)} className={inp}>
                          <option value="">Consumidor final</option>
                          <option value="consumidor_final">Consumidor final</option>
                          <option value="responsable_inscripto">Responsable inscripto</option>
                          <option value="monotributista">Monotributista</option>
                          <option value="exento">Exento</option>
                          <option value="no_responsable">No responsable</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* NOTAS */}
                  <div>
                    <SubHeader icon={FileText} label="Notas" color="text-blue-600" />
                    <textarea
                      value={form.notas}
                      onChange={e => set('notas', e.target.value)}
                      rows={3}
                      placeholder="Observaciones adicionales sobre el cliente..."
                      className={cn(inp, 'resize-none')}
                    />
                  </div>

                  {/* WhatsApp banner */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                    <p className="text-[12px] text-emerald-700 mb-3 leading-snug">
                      Podrás completar o actualizar estos datos<br />
                      después por WhatsApp o desde la ficha del cliente.
                    </p>
                    {form.telefono && (
                      <a
                        href={`https://wa.me/${form.telefono.replace(/\D/g, '')}?text=${encodeURIComponent('Hola! Te contactamos para completar tus datos.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
                        <MessageCircle size={13} /> Enviar enlace por WhatsApp
                      </a>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* ══ BOTTOM: Importante + Flujo ════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            {/* Importante */}
            <div className="flex items-start gap-2">
              <Star size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-amber-700 mb-1">Importante</div>
                <div className="text-[11px] text-gray-500 leading-snug">
                  Estos datos complementarios no son obligatorios ahora. Los podrás completar cuando sea necesario.
                </div>
              </div>
            </div>
            {/* Flujo */}
            <div className="sm:col-span-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 text-center">Así funciona el flujo</div>
              <div className="flex items-center justify-center gap-2">
                {[
                  { n: 1, title: 'Datos iniciales', sub: 'Cargá lo esencial' },
                  { n: 2, title: 'Proforma', sub: 'Cotizá y ofrecé' },
                  { n: 3, title: 'Datos completos', sub: 'Completá la ficha' },
                ].map((step, i) => (
                  <div key={step.n} className="flex items-center gap-2">
                    <div className="text-center">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1',
                        step.n === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'
                      )}>{step.n}</div>
                      <div className="text-[10px] font-bold text-gray-700">{step.title}</div>
                      <div className="text-[10px] text-gray-400">{step.sub}</div>
                    </div>
                    {i < 2 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Sidebar derecho (Perfil) ── */}
        <div className="hidden lg:block w-56 shrink-0 space-y-4">

          {/* Perfil del cliente */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <User size={13} className="text-emerald-600" />
              </div>
              <div className="text-xs font-bold text-gray-700">Perfil del cliente</div>
            </div>
            <div className="text-xs font-bold text-emerald-600 mb-1.5">{completion}% completo</div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-400 leading-snug">
              Completá más datos para mejorar el perfil y habilitar funciones del CRM.
            </div>
          </div>

          {/* Consejos */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={13} className="text-amber-500" />
              <div className="text-xs font-bold text-gray-700">Consejos</div>
            </div>
            <div className="space-y-3">
              {[
                { icon: <Clock size={12} />, text: 'Cargá solo lo necesario para avanzar rápido.' },
                { icon: <Hash size={12} />, text: 'Podrás completar todos los datos más adelante.' },
                { icon: <MessageCircle size={12} />, text: 'Así no cortamos la conversación.' },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-gray-500">
                  <span className="text-blue-400 mt-0.5 shrink-0">{tip.icon}</span>
                  <span className="leading-snug">{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
