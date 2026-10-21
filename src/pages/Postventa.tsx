import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { HeartHandshake, Loader2, Send, CalendarClock, X, Phone, MessageSquare, CheckCircle2, Ban, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { useAuth } from '@/hooks/useAuth';
import { HelpButton } from '@/components/HelpButton';
import { api } from '@/lib/api';
import { cn, haceCuanto } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import { Estrellas } from '@/components/postventa/Estrellas';

type Tab = 'hoy' | 'proximos' | 'enviados' | 'respondidos' | 'descartados';
interface Seguimiento {
  id: string; estado: string; fecha_entrega: string; fecha_contacto: string; dias_atraso: number;
  enviado_at: string | null; respondido_at: string | null; canal_respuesta: 'link' | 'manual' | null;
  comentario: string | null; motivo_descarte: string | null; operacion_id: string; cliente_id: string;
  puntaje_productos: number | null; puntaje_entrega: number | null; puntaje_atencion: number | null;
  operacion_numero: string; telefono: string | null; productos: string;
  tipo_persona: string; nombre: string | null; apellido: string | null; razon_social: string | null;
}
interface Resumen {
  para_hoy: number; proximos: number; sin_respuesta: number; respondidos_90d: number; contactados_90d: number;
  prom_productos: number | null; prom_entrega: number | null; prom_atencion: number | null;
  insatisfechos_90d: number; tasa_respuesta: number | null; dias: number;
}

const TABS: { v: Tab; l: string }[] = [
  { v: 'hoy', l: 'Para contactar' }, { v: 'proximos', l: 'Próximos' }, { v: 'enviados', l: 'Sin respuesta' },
  { v: 'respondidos', l: 'Respondidos' }, { v: 'descartados', l: 'Descartados' },
];

const quien = (s: Pick<Seguimiento, 'tipo_persona' | 'nombre' | 'apellido' | 'razon_social'>) =>
  s.tipo_persona === 'juridica' ? (s.razon_social ?? '—') : [s.apellido, s.nombre].filter(Boolean).join(', ') || '—';
const fecha = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
const bajo = (s: Seguimiento) => Math.min(s.puntaje_productos ?? 5, s.puntaje_entrega ?? 5, s.puntaje_atencion ?? 5) <= 2;

// Post venta: a los N días de cada entrega se le pregunta al cliente cómo le fue. El operador revisa el mensaje
// (plantilla editable) y lo manda con un clic; la respuesta llega por el link de la encuesta o se carga a mano.
export default function Postventa() {
  const { user } = useAuth();
  const puede = user?.rol !== 'consulta';
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some(t => t.v === params.get('tab')) ? params.get('tab') : 'hoy') as Tab;
  const [lista, setLista] = useState<Seguimiento[] | null>(null);
  const [conteos, setConteos] = useState<Record<Tab, number> | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState(false);
  const [accion, setAccion] = useState<{ tipo: 'enviar' | 'respuesta' | 'reprogramar' | 'descartar'; s: Seguimiento } | null>(null);

  const cargar = useCallback(() => {
    api.get<{ seguimientos: Seguimiento[]; conteos: Record<Tab, number> }>(`/postventa?tab=${tab}`)
      .then(r => { setLista(r.seguimientos); setConteos(r.conteos); setError(false); }).catch(() => setError(true));
    api.get<Resumen>('/postventa/resumen').then(setResumen).catch(() => {});
  }, [tab]);
  useEffect(() => { setLista(null); cargar(); }, [cargar]);   // eslint-disable-line react-hooks/set-state-in-effect

  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };
  const hecho = () => { setAccion(null); cargar(); };

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1100px] mx-auto" data-section="crm">
      <SectionHero section="crm" icon={HeartHandshake} title="Post venta"
        sub="Preguntarle al cliente cómo le fue unos días después de la entrega"
        actions={<HelpButton topic="postventa" />} />

      {resumen && <Indicadores r={resumen} esAdmin={user?.rol === 'admin'} onDias={cargar} />}

      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)} data-testid={`tab-${t.v}`}
            className={cn('flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              tab === t.v ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-gray-600 border-gray-200 hover:border-rose-400 hover:text-rose-700')}>
            {t.l}
            {conteos && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', tab === t.v ? 'bg-white/20' : 'bg-rose-100 text-rose-800')}>{conteos[t.v]}</span>}
          </button>
        ))}
      </div>

      {error && !lista && <p className="text-sm text-red-700">No se pudo cargar. Probá de nuevo en un momento.</p>}
      {!lista && !error && <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}
      {lista && lista.length === 0 && (
        <p className="rounded-2xl border border-gray-300 bg-white py-10 text-center text-sm text-gray-600">
          {tab === 'hoy' ? 'No hay clientes para contactar hoy. Los seguimientos aparecen solos cuando se entrega un pedido.' : 'No hay seguimientos en esta lista.'}
        </p>
      )}
      <div className="space-y-2.5">
        {lista?.map(s => <Tarjeta key={s.id} s={s} tab={tab} puede={puede} onAccion={(tipo) => setAccion({ tipo, s })} />)}
      </div>

      {accion?.tipo === 'enviar' && <ModalEnviar s={accion.s} onClose={() => setAccion(null)} onHecho={hecho} />}
      {accion?.tipo === 'respuesta' && <ModalRespuesta s={accion.s} onClose={() => setAccion(null)} onHecho={hecho} />}
      {accion?.tipo === 'reprogramar' && <ModalReprogramar s={accion.s} onClose={() => setAccion(null)} onHecho={hecho} />}
      {accion?.tipo === 'descartar' && <ModalDescartar s={accion.s} onClose={() => setAccion(null)} onHecho={hecho} />}
    </div>
  );
}

function Indicadores({ r, esAdmin, onDias }: { r: Resumen; esAdmin: boolean; onDias: () => void }) {
  const [editando, setEditando] = useState(false);
  const [dias, setDias] = useState(String(r.dias));
  async function guardar() {
    try {
      await api.put('/empresa', { postventa_dias: Number(dias) });
      toast.success('Listo: se contacta a los ' + dias + ' días de la entrega (aplica a las próximas entregas)');
      setEditando(false); onDias();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); }
  }
  const K = ({ v, l, c }: { v: string | number; l: string; c?: string }) => (
    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 min-w-[7.5rem] flex-1">
      <p className={cn('text-lg font-black tabular-nums leading-tight', c ?? 'text-gray-900')}>{v}</p>
      <p className="text-[11px] text-gray-600 leading-tight">{l}</p>
    </div>
  );
  return (
    <div className="space-y-2" data-testid="postventa-indicadores">
      <div className="flex flex-wrap gap-2">
        <K v={r.para_hoy} l="para contactar" c={r.para_hoy ? 'text-rose-700' : undefined} />
        <K v={r.sin_respuesta} l="sin respuesta" />
        <K v={r.tasa_respuesta === null ? '—' : `${r.tasa_respuesta} %`} l="respondieron (90 días)" />
        <K v={r.prom_productos ?? '—'} l="producto (de 5)" />
        <K v={r.prom_entrega ?? '—'} l="entrega (de 5)" />
        <K v={r.prom_atencion ?? '—'} l="atención (de 5)" />
        {r.insatisfechos_90d > 0 && <K v={r.insatisfechos_90d} l="insatisfechos" c="text-red-700" />}
      </div>
      <p className="text-xs text-gray-700 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Settings2 size={13} className="text-gray-500" />
        Se contacta a los
        {editando ? (
          <>
            <input type="number" min={0} max={60} value={dias} onChange={e => setDias(e.target.value)} className="h-9 w-16 px-2 rounded-lg border border-gray-300 text-sm" aria-label="Días después de la entrega" />
            días <button onClick={guardar} className="h-9 px-3 rounded-lg bg-rose-700 text-white font-bold">Guardar</button>
            <button onClick={() => { setEditando(false); setDias(String(r.dias)); }} className="h-9 px-3 rounded-lg border border-gray-300 bg-white">Cancelar</button>
          </>
        ) : (
          <>
            <b>{r.dias} días</b> de la entrega.
            {esAdmin && <button onClick={() => setEditando(true)} className="text-rose-700 font-semibold hover:underline">Cambiar</button>}
          </>
        )}
        <span className="text-gray-500">El mensaje se edita en Configuración → Mensajes.</span>
      </p>
    </div>
  );
}

function Tarjeta({ s, tab, puede, onAccion }: { s: Seguimiento; tab: Tab; puede: boolean; onAccion: (t: 'enviar' | 'respuesta' | 'reprogramar' | 'descartar') => void }) {
  const btn = 'h-10 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5';
  return (
    <div className={cn('rounded-2xl border bg-white p-3 sm:p-4', s.estado === 'respondido' && bajo(s) ? 'border-red-400' : 'border-gray-300')} data-testid="postventa-tarjeta">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-bold text-gray-900 truncate">{quien(s)}</p>
          <p className="text-xs text-gray-600 truncate">{s.operacion_numero.replace(/^OP-/, 'PRO-')} · {s.productos}</p>
          {s.telefono && <p className="text-[11px] text-gray-500 inline-flex items-center gap-1"><Phone size={10} />{s.telefono}</p>}
        </div>
        <div className="text-xs text-gray-700 sm:text-right">
          <p>Entregado el {fecha(s.fecha_entrega)}</p>
          {s.estado === 'pendiente' && (
            <p className={cn('font-semibold', s.dias_atraso > 0 ? 'text-amber-700' : 'text-gray-700')}>
              {s.dias_atraso > 0 ? `Para contactar desde hace ${s.dias_atraso} día${s.dias_atraso !== 1 ? 's' : ''}` : `Contactar el ${fecha(s.fecha_contacto)}`}
            </p>
          )}
          {s.estado === 'enviado' && s.enviado_at && <p className="font-semibold">Enviado {haceCuanto(s.enviado_at)}</p>}
          {s.estado === 'respondido' && s.respondido_at && <p className="font-semibold">Respondió {haceCuanto(s.respondido_at)}{s.canal_respuesta === 'manual' ? ' (cargado a mano)' : ''}</p>}
        </div>
      </div>

      {s.estado === 'respondido' && (
        <div className="mt-2 grid sm:grid-cols-3 gap-2 text-xs">
          {([['Producto', s.puntaje_productos], ['Entrega', s.puntaje_entrega], ['Atención', s.puntaje_atencion]] as const).map(([l, v]) => (
            <div key={l} className="flex items-center justify-between sm:block rounded-lg bg-gray-50 px-2 py-1.5"><span className="text-gray-600">{l}</span> <Estrellas value={v} tam={15} etiqueta={l} /></div>
          ))}
          {s.comentario && <p className="sm:col-span-3 italic text-gray-800 bg-amber-50 rounded-lg px-2 py-1.5 flex gap-1.5"><MessageSquare size={13} className="shrink-0 mt-0.5 text-amber-600" />{s.comentario}</p>}
        </div>
      )}
      {s.estado === 'descartado' && s.motivo_descarte && <p className="mt-2 text-xs text-gray-600">Motivo: {s.motivo_descarte}</p>}

      {puede && ['pendiente', 'enviado'].includes(s.estado) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => onAccion('enviar')} data-testid="postventa-enviar" className={cn(btn, 'bg-green-600 text-white hover:bg-green-700')}>
            <Send size={14} /> {s.estado === 'enviado' ? 'Reenviar WhatsApp' : 'Enviar WhatsApp'}
          </button>
          {s.estado === 'enviado' && (
            <button onClick={() => onAccion('respuesta')} className={cn(btn, 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50')}><CheckCircle2 size={14} /> Cargar respuesta</button>
          )}
          {s.estado === 'pendiente' && (
            <>
              <button onClick={() => onAccion('respuesta')} className={cn(btn, 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50')}><CheckCircle2 size={14} /> Ya respondió</button>
              <button onClick={() => onAccion('reprogramar')} className={cn(btn, 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50')}><CalendarClock size={14} /> Reprogramar</button>
            </>
          )}
          <button onClick={() => onAccion('descartar')} className={cn(btn, 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50')}><Ban size={14} /> Descartar</button>
        </div>
      )}
      {tab === 'hoy' && !s.telefono && <p className="mt-2 text-xs text-red-700">El cliente no tiene teléfono cargado.</p>}
    </div>
  );
}

function Modal({ titulo, sub, onClose, ocupado, children, pie }: { titulo: string; sub?: string; onClose: () => void; ocupado?: boolean; children: React.ReactNode; pie: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, ocupado]);
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4" onClick={e => { if (e.target === e.currentTarget && !ocupado) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg max-h-[92dvh] mt-auto sm:mt-0 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col" data-testid="postventa-modal">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <div className="flex-1 min-w-0"><p className="font-bold text-gray-900 leading-tight">{titulo}</p>{sub && <p className="text-xs text-gray-600 truncate">{sub}</p>}</div>
          <button type="button" onClick={onClose} disabled={ocupado} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">{children}</div>
        <div className="border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">{pie}</div>
      </div>
    </div>, document.body);
}

function ModalEnviar({ s, onClose, onHecho }: { s: Seguimiento; onClose: () => void; onHecho: () => void }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { api.get<{ mensaje: string }>(`/postventa/${s.id}/mensaje`).then(r => setMensaje(r.mensaje)).catch(() => { toast.error('No se pudo armar el mensaje'); onClose(); }); }, [s.id, onClose]);
  async function enviar() {
    if (!mensaje) return;
    setEnviando(true);
    try { await api.post(`/postventa/${s.id}/enviar`, { mensaje }); toast.success('Mensaje enviado por WhatsApp'); onHecho(); }
    catch (e) { toastApiError(e, { fallback: 'No se pudo enviar' }); setEnviando(false); }
  }
  return (
    <Modal titulo="Enviar por WhatsApp" sub={`${quien(s)} · ${s.telefono ?? 'sin teléfono'}`} onClose={onClose} ocupado={enviando}
      pie={<>
        <button type="button" onClick={onClose} disabled={enviando} className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={enviar} disabled={!mensaje || enviando || !s.telefono} data-testid="postventa-confirmar-envio"
          className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar
        </button>
      </>}>
      {mensaje === null ? <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
        <>
          <label className="block text-xs font-bold text-gray-800">Mensaje (podés editarlo)
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={9}
              className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-base font-normal focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </label>
          <p className="text-xs text-gray-600">Incluye el link de la encuesta: <b>no lo borres</b>. La plantilla se cambia en Configuración → Mensajes.</p>
        </>
      )}
    </Modal>
  );
}

function ModalRespuesta({ s, onClose, onHecho }: { s: Seguimiento; onClose: () => void; onHecho: () => void }) {
  const [p, setP] = useState<{ productos: number | null; entrega: number | null; atencion: number | null }>({ productos: null, entrega: null, atencion: null });
  const [coment, setComent] = useState('');
  const [guardando, setGuardando] = useState(false);
  const algo = p.productos || p.entrega || p.atencion || coment.trim();
  async function guardar() {
    setGuardando(true);
    try {
      await api.post(`/postventa/${s.id}/respuesta-manual`, { puntaje_productos: p.productos, puntaje_entrega: p.entrega, puntaje_atencion: p.atencion, comentario: coment.trim() || undefined });
      toast.success('Respuesta guardada'); onHecho();
    } catch (e) { toastApiError(e, { fallback: 'No se pudo guardar' }); setGuardando(false); }
  }
  return (
    <Modal titulo="Cargar la respuesta del cliente" sub={quien(s)} onClose={onClose} ocupado={guardando}
      pie={<>
        <button type="button" onClick={onClose} disabled={guardando} className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={guardar} disabled={!algo || guardando} className="flex-1 h-12 rounded-xl bg-rose-700 text-white text-sm font-bold disabled:opacity-50">Guardar respuesta</button>
      </>}>
      <p className="text-xs text-gray-600">Si el cliente contestó por chat o por teléfono, cargá lo que te dijo (alcanza con una de las tres notas).</p>
      {([['productos', 'Producto'], ['entrega', 'Entrega e instalación'], ['atencion', 'Atención en la venta']] as const).map(([k, l]) => (
        <div key={k} className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">{l}</span>
          <Estrellas value={p[k]} onChange={v => setP(prev => ({ ...prev, [k]: v }))} etiqueta={l} />
        </div>
      ))}
      <textarea value={coment} onChange={e => setComent(e.target.value)} rows={3} maxLength={1000} placeholder="Comentario del cliente (opcional)" aria-label="Comentario"
        className="w-full rounded-xl border border-gray-300 p-3 text-base focus:outline-none focus:ring-2 focus:ring-rose-400" />
    </Modal>
  );
}

function ModalReprogramar({ s, onClose, onHecho }: { s: Seguimiento; onClose: () => void; onHecho: () => void }) {
  const [f, setF] = useState(s.fecha_contacto.slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    try { await api.patch(`/postventa/${s.id}/reprogramar`, { fecha: f }); toast.success('Reprogramado'); onHecho(); }
    catch (e) { toastApiError(e, { fallback: 'No se pudo reprogramar' }); setGuardando(false); }
  }
  return (
    <Modal titulo="Reprogramar el contacto" sub={quien(s)} onClose={onClose} ocupado={guardando}
      pie={<>
        <button type="button" onClick={onClose} disabled={guardando} className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={guardar} disabled={!f || guardando} className="flex-1 h-12 rounded-xl bg-rose-700 text-white text-sm font-bold disabled:opacity-50">Guardar</button>
      </>}>
      <label className="block text-xs font-bold text-gray-800">Contactar el
        <input type="date" value={f} onChange={e => setF(e.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-300 text-base font-normal" />
      </label>
    </Modal>
  );
}

const MOTIVOS = ['Ya hablamos con el cliente', 'Obra o pedido con problemas (se atiende aparte)', 'El cliente pidió que no lo contactemos'];
function ModalDescartar({ s, onClose, onHecho }: { s: Seguimiento; onClose: () => void; onHecho: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  async function descartar() {
    setGuardando(true);
    try { await api.patch(`/postventa/${s.id}/descartar`, { motivo: motivo.trim() || undefined }); toast.success('Descartado'); onHecho(); }
    catch (e) { toastApiError(e, { fallback: 'No se pudo descartar' }); setGuardando(false); }
  }
  return (
    <Modal titulo="Descartar este seguimiento" sub={quien(s)} onClose={onClose} ocupado={guardando}
      pie={<>
        <button type="button" onClick={onClose} disabled={guardando} className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={descartar} disabled={guardando} className="flex-1 h-12 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50">Descartar</button>
      </>}>
      <p className="text-sm text-gray-800">No se le va a preguntar nada a este cliente por esta entrega.</p>
      <div className="grid gap-2">
        {MOTIVOS.map(m => (
          <button key={m} type="button" onClick={() => setMotivo(m)}
            className={cn('min-h-11 px-3 py-2 rounded-xl border-2 text-left text-sm font-medium', motivo === m ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 text-gray-700')}>{m}</button>
        ))}
      </div>
      <input value={MOTIVOS.includes(motivo) ? '' : motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} placeholder="Otro motivo (opcional)" aria-label="Otro motivo"
        className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base" />
    </Modal>
  );
}
