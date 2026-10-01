import { toast } from 'sonner';
import { api } from '@/lib/api';
import { avisarCambioAgenda } from '@/lib/agenda';
import type { OpcionRecordar } from './ItemTarea';

// Acciones sobre la agenda, iguales desde el aviso del día y desde la pantalla Agenda. Cada
// cambio se avisa a esta pestaña (evento) y a las otras (BroadcastChannel): así el aviso no
// se repite en dos pestañas y lo que se hace en una se ve en las demás.

type Mensaje = { t: 'cambio' } | { t: 'abierto' } | { t: 'cerrado' };

const canal: BroadcastChannel | null = (() => {
  try { return typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('aberturas-agenda') : null; } catch { return null; }
})();

export function publicar(m: Mensaje) {
  try { canal?.postMessage(m); } catch { /* sin canal */ }
}

export function escuchar(fn: (m: Mensaje) => void): () => void {
  if (!canal) return () => {};
  const h = (e: MessageEvent<Mensaje>) => fn(e.data);
  canal.addEventListener('message', h);
  return () => canal.removeEventListener('message', h);
}

function cambio() {
  avisarCambioAgenda();
  publicar({ t: 'cambio' });
}

/** Ejecuta y, si falla, avisa con un toast y relanza (la fila queda como estaba). */
async function conAviso<T>(fn: () => Promise<T>, mensaje: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    toast.error(mensaje, { description: (e as Error).message });
    throw e;
  }
}

export const completar = (id: string) => conAviso(async () => {
  await api.patch(`/tareas/${id}/completar`, { completada: true });
  cambio();
}, 'No se pudo marcar como hecha');

export const recordar = (ids: string[], o: OpcionRecordar, respetarPosterior = false) => conAviso(async () => {
  await api.post('/agenda/recordar', { tarea_ids: ids, ...o, respetar_posterior: respetarPosterior });
  publicar({ t: 'cambio' });
}, 'No se pudo guardar el recordatorio');

export const reprogramar = (ids: string[], fecha: string, hora?: string | null) => conAviso(async () => {
  await api.patch('/agenda/reprogramar', { tarea_ids: ids, fecha, ...(hora !== undefined ? { hora } : {}) });
  cambio();
}, 'No se pudo reprogramar');

export { cambio as avisarCambio };
