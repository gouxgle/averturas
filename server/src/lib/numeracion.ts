import type { PoolClient } from 'pg';
import { mesAR } from './fechas.js';

type Queryable = Pick<PoolClient, 'query'>;

// Tablas con número correlativo `PREFIJO-YYYYMM-NNNN`. Lista cerrada: el nombre va
// interpolado en el SQL, nunca puede venir del request.
export type TablaNumerada =
  | 'recibos' | 'remitos' | 'visitas_tecnicas'
  | 'compras_solicitudes' | 'compras_cotizaciones' | 'pedidos' | 'compras_incidencias';

/**
 * Próximo número `PREFIJO-YYYYMM-NNNN` (correlativo mensual). Tiene que llamarse con el
 * client de una transacción abierta (después del BEGIN) y el INSERT ir en esa misma
 * transacción: el advisory lock se libera recién en el COMMIT/ROLLBACK, así que dos
 * altas simultáneas se ordenan en vez de leer el mismo MAX y chocar contra el UNIQUE.
 * MAX del sufijo, nunca COUNT(*): un borrado deja huecos y COUNT regeneraría un número.
 */
export async function siguienteNumero(client: Queryable, tabla: TablaNumerada, prefijo: string): Promise<string> {
  const base = `${prefijo}-${mesAR()}-`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`numeracion:${tabla}:${base}`]);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(numero FROM '(\\d+)$')::int), 0) AS n FROM ${tabla} WHERE numero LIKE $1`,
    [`${base}%`]
  );
  const n = Number((rows[0] as { n: number }).n) + 1;
  return `${base}${String(n).padStart(4, '0')}`;
}
