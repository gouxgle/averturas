import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Wrench, Loader2, Phone, MapPin, Package, CalendarClock, Pencil, Ban, RotateCcw, CheckCircle2, Clock4,
  PlayCircle, History, MessageCircle, Plus, PenLine, FileDown, Send, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { numeroWhatsapp } from '@/lib/telefono';
import { AdjuntosGrid } from '@/components/Adjuntos';
import { NuevoServicio } from '@/components/servicios/NuevoServicio';
import { ModalIntervencion } from '@/components/servicios/ModalIntervencion';
import { FirmaServicio } from '@/components/servicios/FirmaServicio';
import { abrirPdfApi } from '@/lib/abrirPdf';
import { PanelCobro, PanelProveedor } from '@/components/servicios/PanelesServicio';
import { campoCls, btnPrim, btnSec, etiquetaCls } from '@/components/servicios/estilos';
import {
  ESTADO_SERVICIO, TIPO_SERVICIO, TRABAJO_TIPO, fechaCortaServicio, type EstadoServicio, type ServicioConIntervenciones, type Intervencion,
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
          <Visitas s={s} puede={puede} onCambio={cargar} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <PanelCobro s={s} puede={puede} onCambio={cargar} />
            <PanelProveedor s={s} puede={puede} onCambio={cargar} />
          </div>
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

const RESULTADO_LABEL: Record<Intervencion['resultado'], string> = {
  resuelto: 'Quedó resuelto', nueva_visita: 'Hace falta otra visita', pendiente_repuesto: 'Falta un repuesto',
};

// Las visitas del técnico, la más nueva arriba. Cada una se firma en el momento (o después) y su ficha en PDF se
// manda al cliente por WhatsApp; firmada ya no se modifica.
function Visitas({ s, puede, onCambio }: { s: ServicioConIntervenciones; puede: boolean; onCambio: () => void }) {
  const [form, setForm] = useState<{ visita?: Intervencion } | null>(null);
  const [firmando, setFirmando] = useState<Intervencion | null>(null);
  const [ofrecerFirma, setOfrecerFirma] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const abierto = s.estado !== 'finalizado' && s.estado !== 'cancelado';
  const ultima = s.intervenciones.length ? s.intervenciones[s.intervenciones.length - 1].orden : 0;
  const visitas = [...s.intervenciones].reverse();

  async function enviar(v: Intervencion) {
    setEnviando(v.id);
    try {
      await api.post(`/servicios-tecnicos/${s.id}/intervenciones/${v.id}/enviar-whatsapp`, {});
      toast.success('Ficha enviada por WhatsApp');
      onCambio();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo enviar' }); }
    finally { setEnviando(null); }
  }
  async function borrar(v: Intervencion) {
    try {
      await api.delete(`/servicios-tecnicos/${s.id}/intervenciones/${v.id}`);
      toast.success('Visita borrada');
      setBorrando(null); onCambio();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo borrar' }); }
  }
  const pdf = (v: Intervencion) => abrirPdfApi(`/servicios-tecnicos/${s.id}/intervenciones/${v.id}/pdf`)
    .catch(e => toast.error(e instanceof Error ? e.message : 'No se pudo abrir el PDF'));

  return (
    <Tarjeta titulo="Visitas" icono={<History size={16} className="text-teal-700" />}
      acciones={puede && abierto && (
        <button onClick={() => setForm({})} className={cn(btnPrim, 'h-10 sm:h-9 px-3 text-xs')} data-testid="registrar-visita"><Plus size={14} /> Registrar visita</button>
      )}>
      {visitas.length === 0 && <p className="text-sm text-gray-600">Todavía no se registró ninguna visita.</p>}
      <div className="space-y-3">
        {visitas.map(v => (
          <article key={v.id} className="rounded-xl border border-gray-200 p-3" data-testid="visita">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-bold text-gray-900">Visita {v.orden} · {fechaCortaServicio(v.fecha)}</p>
                <p className="text-xs text-gray-600">{[v.tecnico, TRABAJO_TIPO[v.trabajo_tipo], v.con_cargo ? 'con cargo' : 'sin cargo'].filter(Boolean).join(' · ')}</p>
              </div>
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border',
                v.resultado === 'resuelto' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-orange-50 text-orange-800 border-orange-200')}>
                {RESULTADO_LABEL[v.resultado]}
              </span>
            </div>
            {v.problema_encontrado && <p className="mt-2 text-sm text-gray-800"><b className="text-gray-600 font-semibold">Encontrado:</b> {v.problema_encontrado}</p>}
            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{v.trabajo_detalle}</p>
            {v.materiales.length > 0 && <p className="mt-1 text-xs text-gray-700">Repuestos: {v.materiales.map(m => `${m.cantidad} × ${m.descripcion}`).join(', ')}</p>}
            {(v.fotos_antes.length > 0 || v.fotos_despues.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-4">
                {v.fotos_antes.length > 0 && <div><p className="text-[11px] text-gray-500 mb-1">Antes</p><AdjuntosGrid urls={v.fotos_antes} size="sm" /></div>}
                {v.fotos_despues.length > 0 && <div><p className="text-[11px] text-gray-500 mb-1">Después</p><AdjuntosGrid urls={v.fotos_despues} size="sm" /></div>}
              </div>
            )}
            {v.observaciones && <p className="mt-1 text-xs text-gray-700"><b>Observaciones:</b> {v.observaciones}</p>}
            {v.pendientes && <p className="mt-1 text-xs text-orange-800"><b>Pendiente:</b> {v.pendientes}</p>}

            <div className="mt-3 pt-2 border-t border-gray-100">
              {v.firmada_at ? (
                <p className={cn('text-xs font-semibold', v.conformidad === 'conforme' ? 'text-emerald-800' : 'text-amber-800')} data-testid="visita-firmada">
                  {v.conformidad === 'conforme' ? 'Recibido conforme' : `Con observaciones: ${v.conformidad_obs}`}
                  <span className="font-normal text-gray-600"> · {v.firma_url ? `firmó ${v.recibio_nombre}` : `sin firma (${v.sin_firma_motivo})`}{v.enviada_whatsapp_at ? ' · enviada por WhatsApp' : ''}</span>
                </p>
              ) : <p className="text-xs font-semibold text-amber-700">Falta la conformidad del cliente</p>}
              {borrando === v.id ? (
                <div className="mt-2 flex items-center gap-2 flex-wrap rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-xs font-semibold text-red-800">¿Borrar esta visita?</span>
                  <button onClick={() => borrar(v)} className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold">Borrar</button>
                  <button onClick={() => setBorrando(null)} className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold">Cancelar</button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {puede && !v.firmada_at && (
                    <button onClick={() => setFirmando(v)} className={cn(btnPrim, 'h-10 sm:h-9 px-3 text-xs')} data-testid="firmar-visita"><PenLine size={14} /> Firmar conformidad</button>
                  )}
                  <button onClick={() => pdf(v)} className={cn(btnSec, 'h-10 sm:h-9 px-3 text-xs')}><FileDown size={14} /> Ver PDF</button>
                  {puede && v.firmada_at && (
                    <button onClick={() => enviar(v)} disabled={enviando === v.id} className={cn(btnSec, 'h-10 sm:h-9 px-3 text-xs text-green-800')}>
                      {enviando === v.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {v.enviada_whatsapp_at ? 'Reenviar' : 'Enviar'} por WhatsApp
                    </button>
                  )}
                  {puede && !v.firmada_at && (
                    <>
                      <button onClick={() => setForm({ visita: v })} className={cn(btnSec, 'h-10 sm:h-9 px-3 text-xs')}><Pencil size={14} /> Editar</button>
                      {v.orden === ultima && <button onClick={() => setBorrando(v.id)} className={cn(btnSec, 'h-10 sm:h-9 px-3 text-xs text-red-700')} aria-label="Borrar visita"><Trash2 size={14} /></button>}
                    </>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {ofrecerFirma && (() => {
        const v = s.intervenciones.find(x => x.id === ofrecerFirma);
        if (!v || v.firmada_at) return null;
        return (
          <div className="mt-3 rounded-xl bg-teal-50 border border-teal-200 p-3 flex items-center gap-2 flex-wrap" data-testid="ofrecer-firma">
            <p className="text-sm font-semibold text-teal-900 flex-1 min-w-[12rem]">¿Está el cliente? Que firme ahora la conformidad.</p>
            <button onClick={() => { setOfrecerFirma(null); setFirmando(v); }} className={btnPrim}><PenLine size={15} /> Firmar ahora</button>
            <button onClick={() => setOfrecerFirma(null)} className={btnSec}>Después</button>
          </div>
        );
      })()}

      {form && (
        <ModalIntervencion servicioId={s.id} tipoServicio={s.tipo} responsableId={s.responsable_id} responsableNombre={s.responsable_nombre}
          visita={form.visita} onClose={() => setForm(null)}
          onGuardada={id => { const nueva = !form.visita; setForm(null); onCambio(); if (nueva) setOfrecerFirma(id); }} />
      )}
      {firmando && (
        <FirmaServicio servicioId={s.id} numero={s.numero} cliente={s.cliente_nombre ?? ''} visita={firmando}
          onClose={() => setFirmando(null)} onFirmada={() => { setFirmando(null); onCambio(); }} />
      )}
    </Tarjeta>
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
  async function recontacto(resultado: 'funciona' | 'sigue_con_problemas') {
    setEnviando(true);
    try {
      await api.patch(`/servicios-tecnicos/${s.id}/recontacto`, { resultado });
      toast.success(resultado === 'funciona' ? 'Listo: el cliente confirmó que funciona' : 'Servicio reabierto para coordinar otra visita');
      onCambio();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
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
          {s.estado === 'finalizado' && s.recontacto_fecha && !s.recontacto_resultado && (
            <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-2" data-testid="recontacto">
              <p className="text-sm font-semibold text-sky-900">Volver a consultar al cliente el {fechaCortaServicio(s.recontacto_fecha)}: ¿quedó funcionando bien?</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => recontacto('funciona')} disabled={enviando} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold" data-testid="recontacto-funciona"><CheckCircle2 size={14} /> Funciona bien</button>
                <button onClick={() => recontacto('sigue_con_problemas')} disabled={enviando} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-red-300 bg-white text-red-700 text-xs font-bold"><RotateCcw size={14} /> Sigue con problemas</button>
              </div>
            </div>
          )}
          {s.recontacto_resultado && (
            <p className={cn('text-sm font-semibold', s.recontacto_resultado === 'funciona' ? 'text-emerald-700' : 'text-red-700')}>
              Consulta posterior: {s.recontacto_resultado === 'funciona' ? 'funciona bien' : 'seguía con problemas'}{s.recontacto_at ? ` (${fechaCortaServicio(s.recontacto_at)})` : ''}
            </p>
          )}
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
