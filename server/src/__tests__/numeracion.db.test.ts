import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { siguienteNumero, type TablaNumerada } from '../lib/numeracion.js';

// Integración contra Postgres real: corre solo con DATABASE_URL definida
// (`DATABASE_URL=… npx vitest run numeracion`). Usa una tabla propia que se borra al final.
const url = process.env.DATABASE_URL;
const TABLA = '_test_numeracion' as TablaNumerada;

describe.skipIf(!url)('siguienteNumero con altas simultáneas', () => {
  const pool = new pg.Pool({ connectionString: url, max: 12 });

  beforeAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${TABLA}; CREATE TABLE ${TABLA} (numero TEXT UNIQUE NOT NULL)`);
  });
  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${TABLA}`);
    await pool.end();
  });

  it('10 altas en paralelo dan 10 números distintos y consecutivos', async () => {
    const alta = async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const numero = await siguienteNumero(client, TABLA, 'TST');
        await new Promise(r => setTimeout(r, 20)); // ventana donde antes chocaban
        await client.query(`INSERT INTO ${TABLA} (numero) VALUES ($1)`, [numero]);
        await client.query('COMMIT');
        return numero;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    };
    const numeros = await Promise.all(Array.from({ length: 10 }, alta));
    const sufijos = numeros.map(n => Number(n.slice(-4))).sort((a, b) => a - b);
    expect(sufijos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
