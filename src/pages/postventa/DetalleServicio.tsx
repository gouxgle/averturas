import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Wrench, Loader2, Phone, MapPin, Package, CalendarClock, Pencil, Ban, RotateCcw, CheckCircle2, Clock4,
  PlayCircle, History, MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { numeroWhatsapp } from '@/lib/telefono';
import { AdjuntosGrid } from '@/components/Adjuntos';
import { NuevoServicio } from '@/components/servicios/NuevoServicio';
import { campoCls, btnPrim, btnSec, etiquetaCls } from '@/components/servicios/estilos';
import {
  ESTADO_SERVICIO, TIPO_SERVICIO, fechaCortaServicio, type EstadoServicio, type ServicioConIntervenciones,
} from '@/lib/servicios';

// Ficha de un servicio técnico: datos del reclamo, programación de la visita (va a la agenda), visitas hechas y
// cierre. Página y no modal: el técnico la abre en el celular desde la agenda.
export default function DetalleServicio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const puede = user?.rol !== 'consulta';
  const [s, setS] = useState<ServicioConIntervenciones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);

  const cargar = useCallback(() => {
    if (!id) return;
    api.get<ServicioConIntervenciones>(`/servicios-tecnicos/${id}`).then(r => { setS(r); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar'));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error && !s) return <div className="p-6 text-sm text-red-700">{error}</div>;
  if (!s) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  const cerrado = s.estado === 'finalizado' || s.estado === 'cancelado';

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1200px] mx-auto" data-section="crm" data-testid="detalle-servicio">
      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <button onClick={() => navigate('/postventa/servicios')} className="h-10 w-10 shrink-0 rounded-xl border border-gray-300 flex items-center justify-center hover:bg-gray-50" aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Wrench size={18} className="text-teal-700" />
              <h1 className="text-lg sm:text-xl font-black text-gray-900">{s.numero}</h1>
              <span className={cn('text-[11px] font-bold text-white px-2 py-1 rounded-md', ESTADO_SERVICIO[s.estado].solido)} data-testid="estado-servicio">{ESTADO_SERVICIO[s.estado].label}</span>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', TIPO_SERVICIO[s.tipo].cls)}>{TIPO_SERVICIO[s.tipo].label}</span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Reclamo del {fechaCortaServicio(s.fecha_reclamo)}{s.creado_por ? ` · cargado por ${s.creado_por}` : ''}
              {s.origen === 'postventa' && ' · desde el seguimiento de post venta'}
            </p>
          </div>
          {puede && !cerrado && (
            <button onClick={() => setEditando(true)} className={btnSec}><Pencil size={15} /> Editar</button>
          )}
        </div>
        {s.estado === 'cancelado' && s.motivo_cancelacion && <p className="mt-2 text-sm text-gray-700">Cancelado: {s.motivo_cancelacion}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Tarjeta titulo="Problema informado">
            <p className="text-[15px] leading-relaxed text-gray-900 whitespace-pre-wrap break-words">{s.problema}</p>
            {s.adjuntos.length > 0 && <div className="mt-3"><AdjuntosGrid urls={s.adjuntos} size="lg" /></div>}
          </Tarjeta>
          <Tarjeta titulo="Visitas" icono={<History size={16} className="text-teal-700" />}>
            {s.intervenciones.length === 0
              ? <p className="text-sm text-gray-600">Todavía no se registró ninguna visita.</p>
              : <p className="text-sm text-gray-600">{s.intervenciones.length} visita(s) registradas.</p>}
          </Tarjeta>
        </div>

        <div className="space-y-4 min-w-0">
          <Tarjeta titulo="Cliente">
            <Link to={`/clientes/${s.cliente_id}`} className="text-sm font-bold text-teal-800 hover:underline">{s.cliente_nombre}</Link>
            <div className="mt-1.5 space-y-1 text-sm text-gray-700">
              {s.cliente_telefono && (
                <p className="flex items-center gap-2 flex-wrap">
                  <Phone size={14} className="text-gray-500" />
                  <a href={`tel:${s.cliente_telefono}`} className="hover:underline">{s.cliente_telefono}</a>
                  {numeroWhatsapp(s.cliente_telefono) && (
                    <a href={`https://wa.me/${numeroWhatsapp(s.cliente_telefono)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline"><MessageCircle size={13} /> WhatsApp</a>
                  )}
                </p>
              )}
              {(s.cliente_direccion || s.cliente_localidad) && (
                <p className="flex items-start gap-2"><MapPin size={14} className="text-gray-500 mt-0.5" />
                  <a className="hover:underline" target="_blank" rel="noopener noreferrer"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.cliente_direccion, s.cliente_localidad].filter(Boolean).join(', '))}`}>
                    {[s.cliente_direccion, s.cliente_localidad].filter(Boolean).join(', ')}
                  </a>
                </p>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Producto" icono={<Package size={16} className="text-teal-700" />}>
            <p className="text-sm font-semibold text-gray-900">{s.producto_descripcion ?? 'Sin producto vinculado'}</p>
            <p className="text-xs text-gray-600 mt-0.5 flex flex-wrap gap-x-2">
              {s.operacion_numero && <Link to={`/presupuestos?id=${s.operacion_id}`} className="text-teal-800 hover:underline">{s.operacion_numero.replace(/^OP-/, 'PRO-')}</Link>}
              {s.remito_numero && <Link to={`/remitos?q=${encodeURIComponent(s.remito_numero)}`} className="text-teal-800 hover:underline">{s.remito_numero}</Link>}
            </p>
            {s.otros_servicios.length > 0 && (
              <div className="mt-2 rounded-lg bg-orange-50 border border-orange-200 p-2">
                <p className="text-xs font-bold text-orange-900">Otros servicios de este producto</p>
                {s.otros_servicios.map(o => (
                  <Link key={o.id} to={`/postventa/servicios/${o.id}`} className="block text-xs text-orange-900 hover:underline mt-1">
                    {o.numero} · {fechaCortaServicio(o.fecha_reclamo)} · {ESTADO_SERVICIO[o.estado].label} — <span className="text-orange-800">{o.problema.slice(0, 80)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Tarjeta>

          <Programacion s={s} puede={puede && !cerrado} onCambio={cargar} />
          {puede && <Estado s={s} onCambio={cargar} />}
        </div>
      </div>

      {editando && <NuevoServicio servicio={s} onClose={() => setEditando(false)} onGuardado={() => { setEditando(false); cargar(); }} />}
    </div>
  );
}

function Tarjeta({ titulo, icono, children, acciones }: { titulo: string; icono?: ReactNode; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-400 shadow-lg p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        {icono}
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-gray-700">{titulo}</h2>
        {acciones && <div className="ml-auto">{acciones}</div>}
      </div>
      {children}
    </section>
  );
}

const OTRA = '__otra__';

function Programacion({ s, puede, onCambio }: { s: ServicioConIntervenciones; puede: boolean; onCambio: () => void }) {
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);
  const [resp, setResp] = useState(s.responsable_id ?? (s.responsable_nombre ? OTRA : ''));
  const [otra, setOtra] = useState(s.responsable_nombre ?? '');
  const [fecha, setFecha] = useState(s.fecha_visita ?? '');
  const [hora, setHora] = useState(s.hora_visita ?? '');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (puede) api.get<{ id: string; nombre: string }[]>('/usuarios/activos').then(setUsuarios).catch(() => {}); }, [puede]);

  const cambiado = resp !== (s.responsable_id ?? (s.responsable_nombre ? OTRA : '')) || (resp === OTRA && otra.trim() !== (s.responsable_nombre ?? ''))
    || fecha !== (s.fecha_visita ?? '') || hora !== (s.hora_visita ?? '');

  async function guardar(sinFecha = false) {
    setGuardando(true);
    try {
      const r = await api.patch<{ estado: EstadoServicio }>(`/servicios-tecnicos/${s.id}/programar`, {
        responsable_id: resp && resp !== OTRA ? resp : null,
        responsable_nombre: resp === OTRA ? otra.trim() || null : null,
        fecha_visita: sinFecha ? null : fecha || null,
        hora_visita: sinFecha || !fecha ? null : hora || null,
      });
      toast.success(r.estado === 'visita_programada' ? 'Visita programada: ya está en la agenda' : 'Guardado');
      if (sinFecha) { setFecha(''); setHora(''); }
      onCambio();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
    finally { setGuardando(false); }
  }

  return (
    <Tarjeta titulo="Visita y responsable" icono={<CalendarClock size={16} className="text-teal-700" />}>
      {!puede ? (
        <div className="text-sm text-gray-800 space-y-0.5">
          <p>Responsable: <b>{s.responsable ?? 'sin asignar'}</b></p>
          <p>Visita: <b>{s.fecha_visita ? `${fechaCortaServicio(s.fecha_visita)}${s.hora_visita ? ` ${s.hora_visita}` : ''}` : 'sin fecha'}</b></p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={etiquetaCls} htmlFor="st-resp">Responsable</label>
            <select id="st-resp" value={resp} onChange={e => setResp(e.target.value)} className={cn(campoCls, 'mt-1')}>
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              {s.responsable_id && !usuarios.some(u => u.id === s.responsable_id) && <option value={s.responsable_id}>{s.responsable}</option>}
              <option value={OTRA}>Otra persona (escribir el nombre)</option>
            </select>
            {resp === OTRA && (
              <input value={otra} onChange={e => setOtra(e.target.value)} maxLength={120} placeholder="Ej.: Instalador externo — Carlos"
                className={cn(campoCls, 'mt-2')} aria-label="Nombre del responsable" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={etiquetaCls} htmlFor="st-fv">Fecha de visita</label>
              <input id="st-fv" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={cn(campoCls, 'mt-1')} />
            </div>
            <div>
              <label className={etiquetaCls} htmlFor="st-hv">Hora <span className="font-normal text-gray-500">(opcional)</span></label>
              <input id="st-hv" type="time" value={hora} onChange={e => setHora(e.target.value)} disabled={!fecha} className={cn(campoCls, 'mt-1')} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => guardar()} disabled={guardando || !cambiado} className={btnPrim} data-testid="programar-servicio">
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />} {fecha ? 'Programar visita' : 'Guardar'}
            </button>
            {s.fecha_visita && (
              <button onClick={() => guardar(true)} disabled={guardando} className={btnSec}>Quitar la fecha</button>
            )}
          </div>
          <p className="text-[11px] text-gray-600">Con fecha, la visita aparece en la Agenda; si se reprograma desde ahí, se actualiza acá.</p>
        </div>
      )}
    </Tarjeta>
  );
}

const ACCIONES: Partial<Record<EstadoServicio, { a: EstadoServicio; l: string; icono: typeof CheckCircle2 }[]>> = {
  pendiente_coordinar: [{ a: 'en_proceso', l: 'Pasar a en proceso', icono: PlayCircle }, { a: 'pendiente_repuesto', l: 'Esperando repuesto', icono: Clock4 }],
  visita_programada:   [{ a: 'en_proceso', l: 'Pasar a en proceso', icono: PlayCircle }, { a: 'pendiente_repuesto', l: 'Esperando repuesto', icono: Clock4 }],
  en_proceso:          [{ a: 'pendiente_repuesto', l: 'Esperando repuesto o nueva visita', icono: Clock4 }],
  pendiente_repuesto:  [{ a: 'en_proceso', l: 'Pasar a en proceso', icono: PlayCircle }],
};

function Estado({ s, onCambio }: { s: ServicioConIntervenciones; onCambio: () => void }) {
  const [modo, setModo] = useState<null | 'finalizar' | 'cancelar'>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cerrado = s.estado === 'finalizado' || s.estado === 'cancelado';

  async function cambiar(estado: EstadoServicio, nota?: string) {
    setEnviando(true);
    try {
      await api.patch(`/servicios-tecnicos/${s.id}/estado`, { estado, nota: nota?.trim() || null });
      toast.success(estado === 'finalizado' ? 'Servicio finalizado' : cerrado ? 'Servicio reabierto' : 'Estado actualizado');
      setModo(null); setTexto(''); onCambio();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cambiar el estado' }); }
    finally { setEnviando(false); }
  }
  async function cancelar() {
    setEnviando(true);
    try {
      await api.patch(`/servicios-tecnicos/${s.id}/cancelar`, { motivo: texto.trim() });
      toast.success('Servicio cancelado');
      setModo(null); setTexto(''); onCambio();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo cancelar' }); }
    finally { setEnviando(false); }
  }

  return (
    <Tarjeta titulo="Estado">
      {cerrado ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">{s.estado === 'finalizado' ? `Finalizado${s.finalizado_at ? ` el ${fechaCortaServicio(s.finalizado_at)}` : ''}.` : 'Cancelado.'}</p>
          <button onClick={() => cambiar('pendiente_coordinar')} disabled={enviando} className={btnSec}><RotateCcw size={15} /> Reabrir</button>
        </div>
      ) : modo === 'cancelar' ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
          <p className="text-sm font-bold text-red-900">¿Cancelar el servicio?</p>
          <input value={texto} onChange={e => setTexto(e.target.value)} maxLength={500} placeholder="Motivo (ej.: el cliente lo resolvió por su cuenta)" className={campoCls} autoFocus />
          <div className="flex gap-2">
            <button onClick={cancelar} disabled={enviando || texto.trim().length < 3} className="inline-flex items-center gap-2 h-11 sm:h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Cancelar servicio</button>
            <button onClick={() => { setModo(null); setTexto(''); }} className={btnSec}>Volver</button>
          </div>
        </div>
      ) : modo === 'finalizar' ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2">
          <p className="text-sm font-bold text-emerald-900">Finalizar el servicio</p>
          <input value={texto} onChange={e => setTexto(e.target.value)} maxLength={500} placeholder="Nota de cierre (opcional)" className={campoCls} autoFocus />
          <div className="flex gap-2">
            <button onClick={() => cambiar('finalizado', texto)} disabled={enviando} className="inline-flex items-center gap-2 h-11 sm:h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50" data-testid="confirmar-finalizar">
              <CheckCircle2 size={15} /> Finalizar
            </button>
            <button onClick={() => { setModo(null); setTexto(''); }} className={btnSec}>Volver</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(ACCIONES[s.estado] ?? []).map(x => (
            <button key={x.a} onClick={() => cambiar(x.a)} disabled={enviando} className={cn(btnSec, 'justify-start')}><x.icono size={15} /> {x.l}</button>
          ))}
          <button onClick={() => setModo('finalizar')} className={cn(btnSec, 'justify-start text-emerald-800')} data-testid="finalizar-servicio"><CheckCircle2 size={15} /> Finalizar</button>
          <button onClick={() => setModo('cancelar')} className={cn(btnSec, 'justify-start text-red-700')}><Ban size={15} /> Cancelar servicio</button>
        </div>
      )}
    </Tarjeta>
  );
}
