import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, X, Plus, ChevronDown, ChevronUp, AlarmClock, CalendarCheck, ListTodo } from 'lucide-react';
import { api, tokenStorage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { TZ_AR } from '@/lib/utils';
import { type TareaAgenda, setAvisoAgendaAbierto, setBotonAgenda, EVENTO_AGENDA, diaAR } from '@/lib/agenda';
import { ItemTarea, type OpcionRecordar } from './ItemTarea';
import { ModalTareaInterna } from './ModalTareaInterna';
import { completar, recordar, reprogramar, publicar, escuchar } from './acciones';

// Aviso de la agenda del día. Reglas (pedido del usuario, 2026-10-01):
// · Al iniciar sesión se abre con TODO lo pendiente de hoy y lo atrasado.
// · Cada tarea: Hecho / Leído (vuelve en 1 h) / Recordar (30 min…4 h o a una hora) /
//   Reprogramar / Ir. Cerrar ("Seguir trabajando") deja todo lo no tocado para dentro de 1 h.
// · Nunca bloquea: se cierra con ✕, Esc o clic afuera y queda una pastilla para reabrirlo.
// Sin acumulación: lo que se muestra es siempre una foto de GET /agenda/hoy (el servidor no
// genera avisos ni a las 00 ni nunca). Abrir el sistema horas después = UN aviso con todo; con
// el aviso abierto, lo que vence se suma a la lista ("Nuevo") en vez de abrir otro encima; con
// varias pestañas avisa una sola (BroadcastChannel); si se está escribiendo, espera.

const POLL_MS = 60_000;
const OTRA_PESTANA_MS = 150_000;
const CLAVE_LOGIN = 'aberturas_agenda_login';     // sessionStorage: aviso de inicio ya mostrado para este token
const CLAVE_SILENCIO = 'aberturas_agenda_silencio'; // sessionStorage: lo usan los e2e para que no tape las pantallas

function escribiendo(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
}

function leer(clave: string): string | null {
  try { return sessionStorage.getItem(clave); } catch { return null; }
}

export function AgendaDelDia() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const soloLectura = user?.rol === 'consulta';
  const [tareas, setTareas] = useState<TareaAgenda[]>([]);
  const [hoy, setHoy] = useState(diaAR(0));
  const [abierto, setAbierto] = useState(false);
  const [visibles, setVisibles] = useState<string[]>([]);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const [verTodasAtrasadas, setVerTodasAtrasadas] = useState(false);
  const [modalInterna, setModalInterna] = useState(false);
  const [masivo, setMasivo] = useState<string | null>(null);

  const abiertoRef = useRef(false);
  const tareasRef = useRef<TareaAgenda[]>([]);
  const visiblesRef = useRef<string[]>([]);
  const otraPestanaHasta = useRef(0);
  const enCurso = useRef(false);
  const esperandoFoco = useRef(false);
  // Si "Seguir trabajando" no pudo guardarse (sin conexión), no se vuelve a abrir enseguida
  const silencioLocal = useRef(new Map<string, number>());

  const fijarVisibles = (ids: string[]) => { visiblesRef.current = ids; setVisibles(ids); };

  const abrir = useCallback((ids: string[]) => {
    fijarVisibles(ids);
    setNuevos(new Set());
    setVerTodasAtrasadas(false);
    abiertoRef.current = true;
    setAbierto(true);
    publicar({ t: 'abierto' });
  }, []);

  const ocultar = useCallback(() => {
    abiertoRef.current = false;
    setAbierto(false);
    fijarVisibles([]);
    publicar({ t: 'cerrado' });
  }, []);

  const cargar = useCallback(async () => {
    if (enCurso.current || leer(CLAVE_SILENCIO)) return;
    enCurso.current = true;
    try {
      const r = await api.get<{ hoy: string; tareas: TareaAgenda[] }>('/agenda/hoy', { silent: true });
      setTareas(r.tareas);
      setHoy(r.hoy);
      const ahora = Date.now();
      const vence = (t: TareaAgenda) => !!t.debe_mostrarse && (silencioLocal.current.get(t.id) ?? 0) < ahora;

      if (abiertoRef.current) {
        // Abierto: se quitan las resueltas en otro lado y se suman las que vencieron (sin abrir otro aviso)
        const ids = new Set(r.tareas.map(t => t.id));
        const siguen = visiblesRef.current.filter(id => ids.has(id));
        const sumar = r.tareas.filter(t => vence(t) && !siguen.includes(t.id)).map(t => t.id);
        if (!siguen.length && !sumar.length) { ocultar(); return; }
        if (sumar.length) setNuevos(prev => new Set([...prev, ...sumar]));
        fijarVisibles([...siguen, ...sumar]);
        publicar({ t: 'abierto' });
        return;
      }

      const token = tokenStorage.get()?.slice(-24) ?? '';
      if (leer(CLAVE_LOGIN) !== token) {
        try { sessionStorage.setItem(CLAVE_LOGIN, token); } catch { /* sin storage */ }
        if (r.tareas.length) abrir(r.tareas.map(t => t.id));   // inicio de sesión: todo, aunque esté pospuesto
        return;
      }

      const vencidas = r.tareas.filter(vence).map(t => t.id);
      if (!vencidas.length) return;
      if (document.visibilityState !== 'visible' || ahora < otraPestanaHasta.current) return;
      if (escribiendo()) { esperandoFoco.current = true; return; }
      abrir(vencidas);
    } catch {
      // Sin conexión o servidor reiniciando: nada de carteles, se reintenta en la próxima consulta
    } finally {
      enCurso.current = false;
    }
  }, [abrir, ocultar]);

  useEffect(() => {
    if (!user) return;
    cargar();
    const t = setInterval(cargar, POLL_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    // Terminó de escribir: si había un recordatorio esperando, se muestra ahora
    const alSoltarFoco = () => {
      if (!esperandoFoco.current) return;
      setTimeout(() => { if (!escribiendo()) { esperandoFoco.current = false; cargar(); } }, 400);
    };
    document.addEventListener('visibilitychange', alVolver);
    document.addEventListener('focusout', alSoltarFoco);
    window.addEventListener(EVENTO_AGENDA, cargar);
    const dejar = escuchar(m => {
      if (m.t === 'abierto') otraPestanaHasta.current = Date.now() + OTRA_PESTANA_MS;
      if (m.t === 'cerrado') otraPestanaHasta.current = 0;
      if (m.t === 'cambio' || m.t === 'cerrado') cargar();
    });
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      document.removeEventListener('focusout', alSoltarFoco);
      window.removeEventListener(EVENTO_AGENDA, cargar);
      dejar();
    };
  }, [user, cargar]);

  useEffect(() => { setAvisoAgendaAbierto(abierto); }, [abierto]);
  useEffect(() => () => { setAvisoAgendaAbierto(false); setBotonAgenda({ total: 0, atrasadas: 0, abrir: null }); }, []);

  // Botón de la barra superior (BotonAgenda): abre el aviso con todo lo pendiente
  const abrirTodo = useCallback(() => abrir(tareasRef.current.map(t => t.id)), [abrir]);
  useEffect(() => {
    tareasRef.current = tareas;
    setBotonAgenda(leer(CLAVE_SILENCIO) ? { total: 0, atrasadas: 0, abrir: null }
      : { total: tareas.length, atrasadas: tareas.filter(t => t.atrasada).length, abrir: abrirTodo });
  }, [tareas, abrirTodo]);

  /** "Seguir trabajando": lo que quedó sin tocar vuelve en 1 h (sin adelantar lo ya pospuesto). */
  const seguirTrabajando = useCallback(() => {
    const ids = visiblesRef.current;
    ocultar();
    if (!ids.length) return;
    api.post('/agenda/recordar', { tarea_ids: ids, en_minutos: 60, respetar_posterior: true }, { silent: true })
      .catch(() => { const hasta = Date.now() + 60 * 60_000; ids.forEach(id => silencioLocal.current.set(id, hasta)); });
  }, [ocultar]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !modalInterna) seguirTrabajando(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, modalInterna, seguirTrabajando]);

  const quitar = (ids: string[]) => {
    const quedan = visiblesRef.current.filter(id => !ids.includes(id));
    if (!quedan.length) ocultar(); else fijarVisibles(quedan);
  };

  const onHecho = async (t: TareaAgenda) => {
    await completar(t.id);
    setTareas(prev => prev.filter(x => x.id !== t.id));
    quitar([t.id]);
  };
  const onRecordar = async (t: TareaAgenda, o: OpcionRecordar) => {
    await recordar([t.id], o);
    quitar([t.id]);
    cargar();
  };
  const onReprogramar = async (t: TareaAgenda, fecha: string, hora: string | null | undefined) => {
    await reprogramar([t.id], fecha, hora);
    if (fecha > hoy) { setTareas(prev => prev.filter(x => x.id !== t.id)); quitar([t.id]); }
    cargar();
  };
  const onIr = (t: TareaAgenda, destino: string) => {
    recordar([t.id], { en_minutos: 60 }).catch(() => {});
    fijarVisibles(visiblesRef.current.filter(id => id !== t.id));
    seguirTrabajando();
    navigate(destino);
  };

  const enLista = visibles.map(id => tareas.find(t => t.id === id)).filter((t): t is TareaAgenda => !!t);
  const atrasadas = enLista.filter(t => t.atrasada);
  const deHoy = enLista.filter(t => !t.atrasada);
  const atrasadasVisibles = atrasadas.length > 5 && !verTodasAtrasadas ? atrasadas.slice(0, 3) : atrasadas;

  async function masivoAtrasadas(accion: 'hoy' | 'recordar') {
    const ids = atrasadas.map(t => t.id);
    if (!ids.length || masivo) return;
    setMasivo(accion);
    try {
      if (accion === 'hoy') await reprogramar(ids, hoy);
      else { await recordar(ids, { en_minutos: 60 }); quitar(ids); }
      await cargar();
    } catch { /* avisado */ } finally {
      setMasivo(null);
    }
  }

  const fechaDia = new Date(`${hoy}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ_AR });
  const fechaLarga = fechaDia.charAt(0).toUpperCase() + fechaDia.slice(1);

  const item = (t: TareaAgenda) => (
    <ItemTarea key={t.id} t={t} hoy={hoy} nuevo={nuevos.has(t.id)} soloLectura={soloLectura}
      onHecho={onHecho} onRecordar={onRecordar} onReprogramar={onReprogramar} onIr={onIr} />
  );

  return (
    <>
      {abierto && enLista.length > 0 && (
        <div className="fixed inset-0 z-[9000] flex items-stretch sm:items-center justify-center bg-slate-900/60 sm:p-4 print:hidden"
          onClick={seguirTrabajando}>
          <div role="dialog" aria-modal="true" aria-labelledby="agenda-dia-titulo"
            className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[100dvh] sm:max-h-[88dvh] overflow-hidden ring-4 ring-orange-400/60"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-4 flex items-center gap-3 text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)' }}>
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <CalendarDays size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="agenda-dia-titulo" className="text-lg sm:text-xl font-extrabold leading-tight">Tu agenda de hoy</h2>
                <p className="text-xs sm:text-sm text-white/90">{fechaLarga} · {enLista.length} pendiente{enLista.length !== 1 ? 's' : ''}
                  {atrasadas.length > 0 && <span> · <b>{atrasadas.length} atrasada{atrasadas.length !== 1 ? 's' : ''}</b></span>}</p>
              </div>
              <button onClick={seguirTrabajando} className="p-2 rounded-xl hover:bg-white/20" aria-label="Cerrar y seguir trabajando">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain bg-gray-50">
              {atrasadas.length > 0 && (
                <section>
                  <div className="px-4 sm:px-5 py-2 bg-red-100 border-b border-red-200 flex items-center gap-2 flex-wrap sticky top-0 z-10">
                    <h3 className="text-xs font-extrabold uppercase tracking-wide text-red-800">Atrasadas ({atrasadas.length})</h3>
                    <div className="ml-auto flex gap-1.5">
                      {!soloLectura && (
                        <button type="button" disabled={!!masivo} onClick={() => masivoAtrasadas('hoy')}
                          className="h-8 px-2.5 rounded-lg bg-white border border-red-300 text-[11px] font-bold text-red-800 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1">
                          <CalendarCheck size={13} /> Pasar todas a hoy
                        </button>
                      )}
                      <button type="button" disabled={!!masivo} onClick={() => masivoAtrasadas('recordar')}
                        className="h-8 px-2.5 rounded-lg bg-white border border-red-300 text-[11px] font-bold text-red-800 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1">
                        <AlarmClock size={13} /> Recordar todas en 1 h
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-red-100">{atrasadasVisibles.map(item)}</div>
                  {atrasadas.length > 5 && (
                    <button type="button" onClick={() => setVerTodasAtrasadas(v => !v)}
                      className="w-full py-2 text-xs font-bold text-red-700 hover:bg-red-50 inline-flex items-center justify-center gap-1 border-t border-red-100">
                      {verTodasAtrasadas ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver las {atrasadas.length - 3} restantes</>}
                    </button>
                  )}
                </section>
              )}
              {deHoy.length > 0 && (
                <section>
                  <div className="px-4 sm:px-5 py-2 bg-orange-50 border-y border-orange-200 sticky top-0 z-10">
                    <h3 className="text-xs font-extrabold uppercase tracking-wide text-orange-800">Hoy ({deHoy.length})</h3>
                  </div>
                  <div className="divide-y divide-gray-100">{deHoy.map(item)}</div>
                </section>
              )}
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-gray-200 bg-white flex flex-wrap items-center gap-2 shrink-0">
              {!soloLectura && (
                <button type="button" onClick={() => setModalInterna(true)}
                  className="h-10 px-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
                  <Plus size={15} /> Tarea interna
                </button>
              )}
              <button type="button" onClick={() => { seguirTrabajando(); navigate('/agenda'); }}
                className="h-10 px-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
                <ListTodo size={15} /> Ver agenda
              </button>
              <p className="hidden md:block text-[11px] text-gray-500 ml-1">Lo que no marques te lo recuerdo en 1 hora.</p>
              <button type="button" onClick={seguirTrabajando}
                className="ml-auto h-11 px-5 rounded-xl bg-[#031d49] text-white text-sm font-bold hover:bg-[#0a2b66] shadow-md">
                Seguir trabajando
              </button>
            </div>
          </div>
        </div>
      )}

      {modalInterna && <ModalTareaInterna onClose={() => setModalInterna(false)} onGuardada={cargar} />}
    </>
  );
}
