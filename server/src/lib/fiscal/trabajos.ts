import { db } from '../../db.js';
import { registrarTrabajo, encolar, iniciarCola } from '../cola.js';
import { conciliar } from './emision.js';

// Trabajos de facturación que corren en la cola.

registrarTrabajo('conciliar_comprobante', async ({ id }) => {
  const r = await conciliar(String(id));
  // Si ARCA sigue sin responder se lanza para que la cola reintente más tarde.
  if (r === 'pendiente') throw new Error('ARCA todavía no confirma el comprobante');
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
}
