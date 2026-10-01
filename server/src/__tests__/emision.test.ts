import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { iniciarArcaFake, emitirCertificadoDePrueba, type EstadoFake } from './arca-fake/servidor.js';

// Emisión completa contra ARCA simulado + base real. Usa la DB local: guarda la
// configuración fiscal y la restaura al final, y borra sus comprobantes (marcados con
// notas='__test_emision__').   DATABASE_URL=… npx vitest run emision

const CUIT = '20444444445';   // distinto por archivo: los tests corren en paralelo y comparten arca_tokens
const MARCA = '__test_emision__';
const PV = 3;

describe.skipIf(!process.env.DATABASE_URL)('emisión de comprobantes contra ARCA simulado', () => {
  let fake: { url: string; estado: EstadoFake; cerrar: () => Promise<void> };
  let dir: string;
  let configOriginal: Record<string, unknown>;
  let pvsOriginales: Record<string, unknown>[];
  type Db = typeof import('../db.js')['db'];
  let db: Db;
  let E: typeof import('../lib/fiscal/emision.js');

  const factura = (over: Record<string, unknown> = {}) => ({
    tipo_doc: 'factura' as const,
    receptor: { doc_tipo: 99, doc_nro: '0', nombre: 'Consumidor Final', condicion_iva_id: 5 },
    items: [{ descripcion: 'Ventana corrediza 150x110', cantidad: 1, precio_unitario: 121_000 }],
    notas: MARCA,
    ...over,
  });

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'emision-test-'));
    process.env.FISCAL_SECRETS_DIR = dir;
    process.env.FISCAL_KEY_SECRET = 'clave-de-prueba-para-tests-1234';
    process.env.ARCA_TIMEOUT_MS = '400';
    fake = await iniciarArcaFake();
    process.env.ARCA_FAKE_URL = fake.url;

    ({ db } = await import('../db.js'));
    E = await import('../lib/fiscal/emision.js');
    const { generarClaveYCsr, leerCsr, guardarCertificado } = await import('../lib/arca/secretos.js');
    await generarClaveYCsr({ cuit: CUIT, razonSocial: 'Prueba SA', alias: 'test' });
    await guardarCertificado('homologacion', emitirCertificadoDePrueba((await leerCsr())!));

    ({ rows: [configOriginal] } = await db.query(`SELECT * FROM fiscal_config WHERE id = 1`));
    ({ rows: pvsOriginales } = await db.query(`SELECT * FROM fiscal_puntos_venta`));
    await db.query(`DELETE FROM fiscal_puntos_venta`);
    await db.query(`INSERT INTO fiscal_puntos_venta (numero, modo) VALUES ($1, 'CAE')`, [PV]);
    await db.query(
      `UPDATE fiscal_config SET habilitada = true, ambiente = 'homologacion', cuit = $1, razon_social = 'Prueba SA',
         domicilio_fiscal = 'Calle 1', iibb = '123', inicio_actividades = '2015-01-01' WHERE id = 1`, [CUIT]);
    await db.query(`DELETE FROM arca_tokens WHERE cuit = $1`, [CUIT]);
  });

  afterAll(async () => {
    const client = await db.connect();
    try {
      // Los autorizados están protegidos por trigger: se apagan solo en esta sesión de limpieza.
      await client.query(`SET session_replication_role = replica`);
      const { rows } = await client.query(`SELECT id FROM comprobantes WHERE notas = $1`, [MARCA]);
      const ids = rows.map(r => r.id);
      await client.query(`DELETE FROM fiscal_eventos WHERE comprobante_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM trabajos_cola WHERE payload->>'id' = ANY($1)`, [ids]);
      await client.query(`DELETE FROM comprobante_items WHERE comprobante_id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM comprobante_iva WHERE comprobante_id = ANY($1)`, [ids]);
      await client.query(`UPDATE comprobantes SET comprobante_asociado_id = NULL WHERE id = ANY($1)`, [ids]);
      await client.query(`DELETE FROM comprobantes WHERE id = ANY($1)`, [ids]);
      await client.query(`SET session_replication_role = DEFAULT`);
    } finally {
      client.release();
    }
    const c = configOriginal;
    await db.query(
      `UPDATE fiscal_config SET habilitada = $1, ambiente = $2, cuit = $3, razon_social = $4, domicilio_fiscal = $5,
         iibb = $6, inicio_actividades = $7 WHERE id = 1`,
      [c.habilitada, c.ambiente, c.cuit, c.razon_social, c.domicilio_fiscal, c.iibb, c.inicio_actividades]);
    await db.query(`DELETE FROM fiscal_puntos_venta`);
    for (const p of pvsOriginales) {
      await db.query(`INSERT INTO fiscal_puntos_venta (id, numero, modo, domicilio, activo) VALUES ($1,$2,$3,$4,$5)`,
        [p.id, p.numero, p.modo, p.domicilio, p.activo]);
    }
    await db.query(`DELETE FROM arca_tokens WHERE cuit = $1`, [CUIT]);
    await db.query(`DELETE FROM fiscal_eventos WHERE comprobante_id IS NULL AND ambiente = 'homologacion' AND created_at > now() - interval '10 minutes'`);
    await fake.cerrar();
    await fs.rm(dir, { recursive: true, force: true });
    await db.end();
  });

  beforeEach(() => {
    fake.estado.errores = {}; fake.estado.demora = {}; fake.estado.demoraDespues = {};
    fake.estado.ultimoAtrasado = 0; fake.estado.tragar.clear();
  });

  const fila = async (id: string) => (await db.query(`SELECT * FROM comprobantes WHERE id = $1`, [id])).rows[0];

  it('emite una factura B a consumidor final y guarda todo lo necesario para reconstruirla', async () => {
    fake.estado.ultimos.set(`${PV}-6`, 41);
    const { id, problemas } = await E.crearBorrador(factura(), null);
    expect(problemas).toEqual([]);
    const r = await E.emitir(id, null);
    expect(r).toMatchObject({ estado: 'autorizado', numero: 42 });
    const c = await fila(id);
    expect(c.clase).toBe('B');
    expect(c.cbte_tipo).toBe(6);
    expect(Number(c.numero)).toBe(42);
    expect(c.cae).toMatch(/^\d{14}$/);
    expect(Number(c.imp_neto)).toBe(100_000);
    expect(Number(c.imp_iva)).toBe(21_000);
    expect(c.emisor.cuit).toBe(CUIT);
    expect(c.hash_fiscal).toMatch(/^[0-9a-f]{64}$/);
    expect(c.request_json.numero).toBe(42);
    const qr = JSON.parse(Buffer.from(new URL(c.qr_url).searchParams.get('p')!, 'base64').toString());
    expect(qr).toMatchObject({ ver: 1, cuit: Number(CUIT), ptoVta: PV, tipoCmp: 6, nroCmp: 42, importe: 121000, tipoCodAut: 'E' });
    const { rows: iva } = await db.query(`SELECT alicuota_id, base_imp, importe FROM comprobante_iva WHERE comprobante_id = $1`, [id]);
    expect(iva.map(i => [i.alicuota_id, Number(i.base_imp), Number(i.importe)])).toEqual([[5, 100000, 21000]]);
  });

  it('un comprobante autorizado no se puede modificar ni borrar', async () => {
    const { id } = await E.crearBorrador(factura(), null);
    await E.emitir(id, null);
    await expect(db.query(`UPDATE comprobantes SET imp_total = 1 WHERE id = $1`, [id])).rejects.toThrow(/no se pueden modificar/);
    await expect(db.query(`DELETE FROM comprobantes WHERE id = $1`, [id])).rejects.toThrow(/no se puede borrar/);
    await expect(db.query(`UPDATE comprobante_items SET total = 1 WHERE comprobante_id = $1`, [id])).rejects.toThrow(/no se puede modificar/);
    // Un campo interno sí.
    await db.query(`UPDATE comprobantes SET notas = $2 WHERE id = $1`, [id, MARCA]);
  });

  it('factura A a un RI exige CUIT y sale con letra A', async () => {
    const { id, problemas } = await E.crearBorrador(factura({
      receptor: { doc_tipo: 80, doc_nro: '30714522538', nombre: 'Constructora SA', condicion_iva_id: 1 },
    }), null);
    expect(problemas).toEqual([]);
    expect(await E.emitir(id, null)).toMatchObject({ estado: 'autorizado' });
    expect((await fila(id)).cbte_tipo).toBe(1);
  });

  it('un rechazo de ARCA no consume número y se puede corregir y reemitir', async () => {
    const antes = fake.estado.ultimos.get(`${PV}-6`) ?? 0;
    const { id } = await E.crearBorrador(factura(), null);
    fake.estado.errores.FECAESolicitar = { code: '10013', msg: 'Rechazo de prueba' };
    const r = await E.emitir(id, null);
    expect(r.estado).toBe('rechazado');
    expect(r.mensajes.join()).toMatch(/10013/);
    expect((await fila(id)).numero).toBeNull();
    expect(fake.estado.ultimos.get(`${PV}-6`)).toBe(antes);
    expect(await E.emitir(id, null)).toMatchObject({ estado: 'autorizado', numero: antes + 1 });
  });

  it('si alguien numeró la serie por fuera justo antes (10016) relee el último y reintenta una vez', async () => {
    const antes = fake.estado.ultimos.get(`${PV}-6`) ?? 0;
    // Otro sistema emitió el antes+1 entre nuestra consulta del último y el pedido de CAE.
    fake.estado.ultimos.set(`${PV}-6`, antes + 1);
    fake.estado.ultimoAtrasado = 1;
    const { id } = await E.crearBorrador(factura(), null);
    expect(await E.emitir(id, null)).toMatchObject({ estado: 'autorizado', numero: antes + 2 });
    expect(fake.estado.llamadas.filter(m => m === 'FECAESolicitar').slice(-2)).toHaveLength(2);
  });

  it('timeout con ARCA que SÍ autorizó: se adopta el CAE sin volver a pedirlo', async () => {
    const antes = fake.estado.ultimos.get(`${PV}-6`) ?? 0;
    fake.estado.demoraDespues.FECAESolicitar = 1000;   // procesa y "pierde" la respuesta
    const { id } = await E.crearBorrador(factura(), null);
    const r = await E.emitir(id, null);
    expect(r).toMatchObject({ estado: 'autorizado', numero: antes + 1 });
    expect(r.mensajes.join()).toMatch(/tardó/);
    expect(fake.estado.llamadas.filter(m => m === 'FECAESolicitar').length).toBeGreaterThan(0);
    expect((await fila(id)).response_json.conciliado_con).toBe('FECompConsultar');
  });

  it('timeout con el pedido todavía en viaje: queda incierto, no se reemite, y se adopta cuando ARCA lo tiene', async () => {
    const antes = fake.estado.ultimos.get(`${PV}-6`) ?? 0;
    fake.estado.demora.FECAESolicitar = 700;            // llega a ARCA DESPUÉS del timeout
    const { id } = await E.crearBorrador(factura(), null);
    const r = await E.emitir(id, null);
    expect(r.estado).toBe('incierto');
    // Otra emisión de la misma serie no puede avanzar mientras esté sin confirmar.
    const otro = await E.crearBorrador(factura(), null);
    await expect(E.emitir(otro.id, null)).rejects.toThrow(/esperando confirmación/);
    await new Promise(res => setTimeout(res, 900));      // ARCA terminó de procesarlo
    expect(await E.conciliar(id)).toBe('autorizado');
    expect(Number((await fila(id)).numero)).toBe(antes + 1);
    expect(await E.emitir(otro.id, null)).toMatchObject({ estado: 'autorizado', numero: antes + 2 });
  });

  it('timeout con un pedido que ARCA nunca recibió: pasado el margen vuelve a borrador y se reemite con el mismo número', async () => {
    const antes = fake.estado.ultimos.get(`${PV}-6`) ?? 0;
    fake.estado.tragar.add('FECAESolicitar');
    const { id } = await E.crearBorrador(factura(), null);
    expect((await E.emitir(id, null)).estado).toBe('incierto');
    expect(await E.conciliar(id)).toBe('pendiente');      // demasiado pronto para concluir
    await db.query(`UPDATE comprobantes SET emitiendo_desde = now() - interval '10 minutes' WHERE id = $1`, [id]);
    expect(await E.conciliar(id)).toBe('no_emitido');
    expect((await fila(id)).estado).toBe('borrador');
    expect(await E.emitir(id, null)).toMatchObject({ estado: 'autorizado', numero: antes + 1 });
  });

  it('la cola de trabajos resuelve sola un comprobante incierto', async () => {
    await import('../lib/fiscal/trabajos.js');           // registra el manejador
    const { procesarPendientes } = await import('../lib/cola.js');
    fake.estado.demora.FECAESolicitar = 700;
    const { id } = await E.crearBorrador(factura(), null);
    expect((await E.emitir(id, null)).estado).toBe('incierto');
    const { rows: [t] } = await db.query(
      `SELECT id FROM trabajos_cola WHERE tipo = 'conciliar_comprobante' AND payload->>'id' = $1 AND estado = 'pendiente'`, [id]);
    expect(t).toBeTruthy();
    await new Promise(res => setTimeout(res, 900));
    await db.query(`UPDATE trabajos_cola SET ejecutar_at = now() WHERE id = $1`, [t.id]);
    await procesarPendientes();
    expect((await fila(id)).estado).toBe('autorizado');
    expect((await db.query(`SELECT estado FROM trabajos_cola WHERE id = $1`, [t.id])).rows[0].estado).toBe('hecho');
  });

  it('emisiones simultáneas de la misma serie salen con números consecutivos sin repetir', async () => {
    const antes = fake.estado.ultimos.get(`${PV}-6`) ?? 0;
    const ids = await Promise.all(Array.from({ length: 6 }, () => E.crearBorrador(factura(), null).then(r => r.id)));
    const rs = await Promise.all(ids.map(id => E.emitir(id, null)));
    expect(rs.every(r => r.estado === 'autorizado')).toBe(true);
    expect(rs.map(r => r.numero).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6].map(i => antes + i));
  });

  it('nota de crédito B asociada a una factura autorizada', async () => {
    const f = await E.crearBorrador(factura(), null);
    await E.emitir(f.id, null);
    const { id, problemas } = await E.crearBorrador({
      ...factura(), tipo_doc: 'nota_credito', comprobante_asociado_id: f.id,
      items: [{ descripcion: 'Devolución parcial', cantidad: 1, precio_unitario: 12_100 }],
    }, null);
    expect(problemas).toEqual([]);
    expect(await E.emitir(id, null)).toMatchObject({ estado: 'autorizado' });
    const c = await fila(id);
    expect(c.cbte_tipo).toBe(8);
    expect(c.request_json.asociado).toMatchObject({ tipo: 6, cuit: CUIT });
  });

  it('arma el PDF con los datos obligatorios, QR y copias en páginas separadas', async () => {
    process.env.CHROMIUM_PATH ??= '/usr/bin/google-chrome';
    const { datosComprobantePDF, htmlComprobante, generarPDFComprobante } = await import('../lib/fiscal/pdfComprobante.js');
    const { id } = await E.crearBorrador(factura({
      receptor: { doc_tipo: 80, doc_nro: '30714522538', nombre: 'Constructora SA', condicion_iva_id: 1, domicilio: 'Calle 2' },
    }), null);
    const borrador = await htmlComprobante((await datosComprobantePDF(id))!);
    expect(borrador).toContain('BORRADOR — SIN VALIDEZ FISCAL');
    await E.emitir(id, null);
    const d = (await datosComprobantePDF(id))!;
    const html = await htmlComprobante(d, ['ORIGINAL', 'DUPLICADO']);
    for (const t of ['COD. 01', 'FACTURA', 'IVA Responsable Inscripto', '30-71452253-8', d.c.cae, 'Vencimiento del CAE',
      'COMPROBANTE DE PRUEBA', 'DUPLICADO', 'Precio unit. (sin IVA)', 'IVA 21%', 'data:image/png;base64']) {
      expect(html).toContain(t);
    }
    // Factura B: bloque de Transparencia Fiscal.
    const b = await E.crearBorrador(factura(), null);
    await E.emitir(b.id, null);
    expect(await htmlComprobante((await datosComprobantePDF(b.id))!)).toContain('Régimen de Transparencia Fiscal al Consumidor');
    const pdf = (await generarPDFComprobante(id, 2))!;
    expect(pdf.pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.pdf.toString('latin1')).toMatch(/\/Type \/Pages[^>]*\/Count 2/);
    expect(pdf.nombre).toMatch(/^Factura-A-00003-\d{8}\.pdf$/);
  }, 60_000);

  it('valida antes de llamar a ARCA y respeta el interruptor general', async () => {
    const { id, problemas } = await E.crearBorrador(factura({
      items: [{ descripcion: 'Obra grande', cantidad: 1, precio_unitario: 12_000_000 }],
    }), null);
    expect(problemas.join()).toMatch(/RG 5700/);
    await expect(E.emitir(id, null)).rejects.toMatchObject({ problemas: expect.arrayContaining([expect.stringMatching(/RG 5700/)]) });
    await db.query(`UPDATE fiscal_config SET habilitada = false WHERE id = 1`);
    try {
      const b = await E.crearBorrador(factura(), null);
      await expect(E.emitir(b.id, null)).rejects.toThrow(/deshabilitada/);
    } finally {
      await db.query(`UPDATE fiscal_config SET habilitada = true WHERE id = 1`);
    }
  });
});
