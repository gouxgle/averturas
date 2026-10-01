import { db } from '../../db.js';
import { registrarTrabajo, encolar, iniciarCola } from '../cola.js';
import { conciliar } from './emision.js';
import { enviarComprobante, type Canal } from './envios.js';
import { informarPendientes, tareasCaea } from './contingencia.js';

// Trabajos de facturación que corren en la cola.

registrarTrabajo('conciliar_comprobante', async ({ id }) => {
  const r = await conciliar(String(id));
  // Si ARCA sigue sin responder se lanza para que la cola reintente más tarde.
  if (r === 'pendiente') throw new Error('ARCA todavía no confirma el comprobante');
});

registrarTrabajo('enviar_comprobante', async ({ id, canal, destino, usuario_id }) => {
  const r = await enviarComprobante(String(id), canal as Canal, String(destino), (usuario_id as string) ?? null, { desdeCola: true });
  if (!r.ok) throw new Error(r.error ?? 'No se pudo enviar');
});

registrarTrabajo('informar_caea', async () => {
  const r = await informarPendientes();
  if (r.pendientes > 0) throw new Error(`Quedan ${r.pendientes} comprobante(s) con CAEA sin informar: ${r.errores.join(' · ')}`);
});

/** Al arrancar: comprobantes que quedaron a mitad de emisión (se cayó el proceso, se cortó ARCA). */
async function retomarPendientes() {
  const { rows } = await db.query(
    `SELECT c.id FROM comprobantes c
      WHERE c.estado IN ('incierto', 'emitiendo')
        AND (c.estado = 'incierto' OR c.emitiendo_desde < now() - interval '2 minutes')
        AND NOT EXISTS (
          SELECT 1 FROM trabajos_cola t
           WHERE t.tipo = 'conciliar_comprobante' AND t.estado IN ('pendiente', 'en_curso')
             AND t.payload->>'id' = c.id::text)`);
  for (const { id } of rows) await encolar('conciliar_comprobante', { id });
}

export function iniciarTrabajosFiscales() {
  iniciarCola(60_000, retomarPendientes);
  // CAEA: pedir el de la quincena con anticipación, informar lo emitido y los "sin movimiento".
  const caea = () => tareasCaea().catch(e => console.error('[caea]', (e as Error).message));
  setTimeout(caea, 30_000).unref();
  setInterval(caea, 3600_000).unref();
}
