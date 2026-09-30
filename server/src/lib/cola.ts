import { db } from '../db.js';

// Cola de trabajos en Postgres (tabla trabajos_cola), sin Redis: un VPS de 2 GB no necesita
// otro servicio para esto. Corre dentro del mismo proceso de la app: cada minuto toma los
// trabajos vencidos con SKIP LOCKED (si algún día hay dos procesos, no se pisan) y
// reintenta con espera creciente hasta max_intentos.

type Manejador = (payload: Record<string, unknown>) => Promise<void>;
const manejadores = new Map<string, Manejador>();

export function registrarTrabajo(tipo: string, fn: Manejador) {
  manejadores.set(tipo, fn);
}

export async function encolar(tipo: string, payload: Record<string, unknown>, opts: { enSegundos?: number; maxIntentos?: number } = {}) {
  await db.query(
    `INSERT INTO trabajos_cola (tipo, payload, ejecutar_at, max_intentos)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval, $4)`,
    [tipo, JSON.stringify(payload), String(opts.enSegundos ?? 0), opts.maxIntentos ?? 8]);
}

/** Espera antes del reintento n: 1, 2, 4, 8… minutos, con tope de 2 horas. */
const esperaMin = (intentos: number) => Math.min(2 ** (intentos - 1), 120);

export async function procesarPendientes(limite = 5): Promise<number> {
  const client = await db.connect();
  let tomados: { id: string; tipo: string; payload: Record<string, unknown>; intentos: number; max_intentos: number }[];
  try {
    await client.query('BEGIN');
    ({ rows: tomados } = await client.query(
      `UPDATE trabajos_cola SET estado = 'en_curso', intentos = intentos + 1, updated_at = now()
        WHERE id IN (
          SELECT id FROM trabajos_cola
           WHERE estado = 'pendiente' AND ejecutar_at <= now()
           ORDER BY ejecutar_at LIMIT $1 FOR UPDATE SKIP LOCKED)
        RETURNING id, tipo, payload, intentos, max_intentos`, [limite]));
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  for (const t of tomados) {
    const fn = manejadores.get(t.tipo);
    try {
      if (!fn) throw new Error(`Sin manejador para el trabajo "${t.tipo}"`);
      await fn(t.payload);
      await db.query(`UPDATE trabajos_cola SET estado = 'hecho', ultimo_error = NULL, updated_at = now() WHERE id = $1`, [t.id]);
    } catch (e) {
      const agotado = t.intentos >= t.max_intentos;
      await db.query(
        `UPDATE trabajos_cola SET estado = $2, ultimo_error = $3, updated_at = now(),
           ejecutar_at = now() + ($4 || ' minutes')::interval
         WHERE id = $1`,
        [t.id, agotado ? 'fallido' : 'pendiente', (e as Error).message?.slice(0, 1000) ?? String(e), String(esperaMin(t.intentos))]);
    }
  }
  return tomados.length;
}

let timer: NodeJS.Timeout | null = null;

/** Arranca el procesamiento periódico. Idempotente. */
export function iniciarCola(intervaloMs = 60_000, alIniciar?: () => Promise<void>) {
  if (timer) return;
  const tick = () => procesarPendientes().catch(e => console.error('[cola]', (e as Error).message));
  alIniciar?.().catch(e => console.error('[cola] al iniciar:', (e as Error).message)).finally(tick);
  timer = setInterval(tick, intervaloMs);
  timer.unref();
}
