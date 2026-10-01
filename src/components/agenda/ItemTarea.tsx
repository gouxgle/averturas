import { useState } from 'react';
import { Check, Eye, AlarmClock, CalendarClock, ArrowRight, Phone, Loader2, Repeat, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type TareaAgenda, metaDe, sujetoDe, telefonoDe, destinoDe, horaCorta, cuandoRecuerda, fechaCorta, diaAR,
} from '@/lib/agenda';

export type OpcionRecordar = { en_minutos: number } | { a_las: string };

interface Props {
  t: TareaAgenda;
  hoy: string;
  nuevo?: boolean;
  soloLectura?: boolean;
  /** En la pantalla Agenda no hay "Leído": el aviso es del modal. */
  conRecordar?: boolean;
  onHecho: (t: TareaAgenda) => Promise<void>;
  onRecordar?: (t: TareaAgenda, o: OpcionRecordar) => Promise<void>;
  onReprogramar: (t: TareaAgenda, fecha: string, hora: string | null | undefined) => Promise<void>;
  onIr?: (t: TareaAgenda, destino: string) => void;
  onEditar?: (t: TareaAgenda) => void;
}

const DIAS_REPETIR: Record<string, string> = { semanal: 'Cada semana', mensual: 'Cada mes' };

// Una tarea del aviso del día o de la pantalla Agenda, con sus acciones. Los botones se
// desactivan mientras guardan (doble clic seguro); los paneles de Recordar y Reprogramar se
// abren debajo de la fila, sin popups flotantes que queden cortados en el scroll del modal.
export function ItemTarea({ t, hoy, nuevo, soloLectura, conRecordar = true, onHecho, onRecordar, onReprogramar, onIr, onEditar }: Props) {
  const [panel, setPanel] = useState<null | 'recordar' | 'reprogramar'>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aLas, setALas] = useState('');
  const [fecha, setFecha] = useState(diaAR(1));
  const [hora, setHora] = useState(horaCorta(t.hora));

  const meta = metaDe(t);
  const Icono = meta.icon;
  const tel = telefonoDe(t);
  const destino = destinoDe(t);
  const atrasada = !t.completada && !!t.vencimiento && t.vencimiento < hoy;
  const diasAtraso = atrasada ? Math.round((new Date(`${hoy}T12:00:00`).getTime() - new Date(`${t.vencimiento}T12:00:00`).getTime()) / 86400000) : 0;
  const pospuesta = t.mostrar_desde && new Date(t.mostrar_desde).getTime() > Date.now();

  async function correr(clave: string, fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(clave);
    // Si falla, quien llama ya avisó con un toast: el panel queda abierto para reintentar.
    try { await fn(); setPanel(null); } catch { /* avisado */ } finally { setOcupado(null); }
  }

  const btn = 'inline-flex items-center gap-1 h-9 px-2.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50';
  const spin = (clave: string, icono: React.ReactNode) => ocupado === clave ? <Loader2 size={14} className="animate-spin" /> : icono;

  return (
    <div className={cn('px-3 sm:px-4 py-3 transition-colors', atrasada ? 'bg-red-50/60' : nuevo ? 'bg-amber-50/70' : 'bg-white')}
      data-tarea-id={t.id}>
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', meta.bg)}>
            <Icono size={16} className={meta.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {t.hora && <span className="text-xs font-extrabold text-gray-900 tabular-nums">{horaCorta(t.hora)}</span>}
              <span className="text-sm font-bold text-gray-900 truncate max-w-full">{sujetoDe(t)}</span>
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', meta.bg, meta.color)}>{meta.label}</span>
              {t.prioridad === 'alta' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Urgente</span>}
              {atrasada && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                {diasAtraso === 1 ? 'De ayer' : `Atrasada ${diasAtraso} días`}</span>}
              {!atrasada && t.vencimiento && t.vencimiento > hoy && <span className="text-[10px] font-semibold text-gray-600">{fechaCorta(t.vencimiento)}</span>}
              {nuevo && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 inline-flex items-center gap-0.5"><Sparkles size={10} />Nuevo</span>}
              {pospuesta && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 inline-flex items-center gap-0.5">
                <AlarmClock size={10} />te recuerdo {cuandoRecuerda(t.mostrar_desde!, hoy)}</span>}
              {t.repetir && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 inline-flex items-center gap-0.5">
                <Repeat size={10} />{DIAS_REPETIR[t.repetir] ?? `Cada ${t.repetir_cada_dias} días`}</span>}
            </div>
            <p className="text-[13px] text-gray-700 leading-snug mt-0.5 break-words">{t.descripcion}</p>
            {t.notas && <p className="text-xs text-gray-600 italic mt-0.5 break-words">{t.notas}</p>}
            {t.completada && (
              <p className="text-[11px] text-emerald-700 mt-0.5">Hecha {t.completada_at ? new Date(t.completada_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''}{t.completada_por ? ` por ${t.completada_por}` : ''}</p>
            )}
          </div>
        </div>

        {!t.completada && (
          <div className="flex items-center gap-1.5 flex-wrap pl-12">
            {!soloLectura && (
              <button type="button" disabled={!!ocupado} onClick={() => correr('hecho', () => onHecho(t))} title="Ya está hecha"
                className={cn(btn, 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700')}>
                {spin('hecho', <Check size={14} />)} Hecho
              </button>
            )}
            {conRecordar && onRecordar && (
              <>
                <button type="button" disabled={!!ocupado} onClick={() => correr('leido', () => onRecordar(t, { en_minutos: 60 }))}
                  title="La vi: recordármela en 1 hora"
                  className={cn(btn, 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
                  {spin('leido', <Eye size={14} />)} Leído
                </button>
                <button type="button" disabled={!!ocupado} onClick={() => setPanel(p => p === 'recordar' ? null : 'recordar')}
                  title="Recordármela más tarde" aria-expanded={panel === 'recordar'}
                  className={cn(btn, panel === 'recordar' ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
                  <AlarmClock size={14} /> Recordar
                </button>
              </>
            )}
            {!soloLectura && (
              <button type="button" disabled={!!ocupado} onClick={() => setPanel(p => p === 'reprogramar' ? null : 'reprogramar')}
                title="Pasarla a otro día" aria-expanded={panel === 'reprogramar'}
                className={cn(btn, panel === 'reprogramar' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
                <CalendarClock size={14} /> <span className="hidden sm:inline">Reprogramar</span><span className="sm:hidden">Otro día</span>
              </button>
            )}
            {tel && (
              <a href={`tel:${tel}`} title={`Llamar al ${tel}`}
                className={cn(btn, 'bg-white border-gray-300 text-sky-700 hover:bg-sky-50')}>
                <Phone size={14} />
              </a>
            )}
            {onEditar && !soloLectura && t.ambito === 'interna' && (
              <button type="button" onClick={() => onEditar(t)} className={cn(btn, 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
                Editar
              </button>
            )}
            {destino && onIr && (
              <button type="button" onClick={() => onIr(t, destino)} title="Abrir"
                className={cn(btn, 'bg-[#031d49] border-[#031d49] text-white hover:bg-[#0a2b66]')}>
                Ir <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {panel === 'recordar' && onRecordar && (
        <div className="mt-2.5 ml-12 rounded-xl border border-sky-200 bg-sky-50 p-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-sky-900 mr-1">Recordármela</span>
          {[30, 60, 120, 240].map(m => (
            <button key={m} type="button" disabled={!!ocupado} onClick={() => correr(`r${m}`, () => onRecordar(t, { en_minutos: m }))}
              className={cn(btn, 'bg-white border-sky-300 text-sky-800 hover:bg-sky-100')}>
              {spin(`r${m}`, null)}en {m < 60 ? `${m} min` : `${m / 60} h`}
            </button>
          ))}
          <span className="text-xs text-sky-900 ml-1">a las</span>
          <input type="time" value={aLas} onChange={e => setALas(e.target.value)} aria-label="Hora del recordatorio"
            className="h-9 px-2 rounded-lg border border-sky-300 bg-white text-sm" />
          <button type="button" disabled={!aLas || !!ocupado} onClick={() => correr('alas', () => onRecordar(t, { a_las: aLas }))}
            className={cn(btn, 'bg-sky-600 border-sky-600 text-white hover:bg-sky-700')}>
            {spin('alas', null)}OK
          </button>
          <button type="button" onClick={() => setPanel(null)} className="ml-auto p-1.5 text-sky-700 hover:bg-sky-100 rounded-lg" aria-label="Cerrar"><X size={14} /></button>
        </div>
      )}

      {panel === 'reprogramar' && (
        <div className="mt-2.5 ml-12 rounded-xl border border-violet-200 bg-violet-50 p-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-violet-900 mr-1">Pasar a</span>
          {[{ l: 'Hoy', n: 0 }, { l: 'Mañana', n: 1 }, { l: 'En 2 días', n: 2 }, { l: 'En una semana', n: 7 }]
            .filter(x => !(x.n === 0 && t.vencimiento === hoy))
            .map(x => (
              <button key={x.n} type="button" onClick={() => setFecha(diaAR(x.n))}
                className={cn(btn, fecha === diaAR(x.n) ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-violet-300 text-violet-800 hover:bg-violet-100')}>
                {x.l}
              </button>
            ))}
          <input type="date" value={fecha} min={diaAR(0)} onChange={e => setFecha(e.target.value)} aria-label="Fecha nueva"
            className="h-9 px-2 rounded-lg border border-violet-300 bg-white text-sm" />
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} aria-label="Hora (opcional)"
            className="h-9 px-2 rounded-lg border border-violet-300 bg-white text-sm" />
          <button type="button" disabled={!fecha || !!ocupado}
            onClick={() => correr('reprog', () => onReprogramar(t, fecha, hora ? hora : (t.hora ? null : undefined)))}
            className={cn(btn, 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700')}>
            {spin('reprog', null)}Guardar
          </button>
          <button type="button" onClick={() => setPanel(null)} className="ml-auto p-1.5 text-violet-700 hover:bg-violet-100 rounded-lg" aria-label="Cerrar"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
