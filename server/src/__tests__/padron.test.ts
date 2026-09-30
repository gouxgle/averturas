import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { iniciarArcaFake, emitirCertificadoDePrueba, type EstadoFake } from './arca-fake/servidor.js';
import { normalizarPersona, tituloPropio } from '../lib/arca/padron.js';
import { condicionIvaId, claveCondicionIva } from '../lib/fiscal/condicionIva.js';

describe('padrón: normalización y condición de IVA', () => {
  it('pasa a formato propio lo que ARCA devuelve en mayúsculas', () => {
    expect(tituloPropio('MARIA DE LOS ANGELES')).toBe('Maria de los Angeles');
    expect(tituloPropio('PADRE PATIÑO')).toBe('Padre Patiño');
  });

  it('deduce la condición de IVA de los impuestos inscriptos', () => {
    const ri = normalizarPersona('30700000008', {
      datosGenerales: { tipoPersona: 'JURIDICA', razonSocial: 'X SA' },
      datosRegimenGeneral: { impuesto: [{ idImpuesto: '10' }, { idImpuesto: '30' }] },
    });
    expect([ri.condicion_iva, ri.condicion_iva_id, ri.tipo_persona]).toEqual(['responsable_inscripto', 1, 'juridica']);
    const exento = normalizarPersona('30700000008', { datosGenerales: { tipoPersona: 'JURIDICA' }, datosRegimenGeneral: { impuesto: { idImpuesto: '32' } } });
    expect(exento.condicion_iva_id).toBe(4);
    const mono = normalizarPersona('27288887778', { datosGenerales: { tipoPersona: 'FISICA' }, datosMonotributo: { impuesto: { idImpuesto: '20' } } });
    expect(mono.condicion_iva).toBe('monotributista');
    const nada = normalizarPersona('20333333334', { errorConstancia: { apellido: 'PEREZ', nombre: 'JUAN', error: 'sin impuestos' } });
    expect([nada.condicion_iva, nada.nombre_completo, nada.avisos]).toEqual(['consumidor_final', 'Perez Juan', ['sin impuestos']]);
  });

  it('traduce la clave del formulario al código de ARCA (vacío = consumidor final)', () => {
    expect(condicionIvaId('')).toBe(5);
    expect(condicionIvaId('responsable_inscripto')).toBe(1);
    expect(condicionIvaId('monotributista')).toBe(6);
    expect(condicionIvaId('no_responsable')).toBe(15);   // valor viejo del formulario
    expect(claveCondicionIva(4)).toBe('exento');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('padrón contra ARCA simulado', () => {
  const CUIT = '20555555556';   // distinto por archivo: los tests corren en paralelo y comparten arca_tokens
  const CONSULTADOS = ['30700000008', '27288887778', '20333333334'];
  let fake: { url: string; estado: EstadoFake; cerrar: () => Promise<void> };
  let dir: string;
  let db: typeof import('../db.js')['db'];
  let consultarPadron: typeof import('../lib/arca/padron.js')['consultarPadron'];
  const ctx = { ambiente: 'homologacion' as const, cuitEmisor: CUIT };

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'padron-test-'));
    process.env.FISCAL_SECRETS_DIR = dir;
    process.env.FISCAL_KEY_SECRET = 'clave-de-prueba-para-tests-1234';
    fake = await iniciarArcaFake();
    process.env.ARCA_FAKE_URL = fake.url;
    ({ db } = await import('../db.js'));
    ({ consultarPadron } = await import('../lib/arca/padron.js'));
    const s = await import('../lib/arca/secretos.js');
    await s.generarClaveYCsr({ cuit: CUIT, razonSocial: 'Prueba SA', alias: 'test' });
    await s.guardarCertificado('homologacion', emitirCertificadoDePrueba((await s.leerCsr())!));
    await db.query(`DELETE FROM padron_cache WHERE cuit = ANY($1)`, [CONSULTADOS]);
    await db.query(`DELETE FROM arca_tokens WHERE cuit = $1`, [CUIT]);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM padron_cache WHERE cuit = ANY($1)`, [CONSULTADOS]);
    await db.query(`DELETE FROM arca_tokens WHERE cuit = $1`, [CUIT]);
    await db.query(`DELETE FROM fiscal_eventos WHERE servicio = 'padron' AND created_at > now() - interval '10 minutes'`);
    await fake.cerrar();
    await fs.rm(dir, { recursive: true, force: true });
    await db.end();
  });

  it('trae una empresa RI con domicilio fiscal y la guarda en caché', async () => {
    const r = await consultarPadron(ctx, '30-70000000-8');
    expect(r.desde_cache).toBe(false);
    expect(r.persona).toMatchObject({
      tipo_persona: 'juridica', razon_social: 'CONSTRUCTORA DEL NORTE S.A.', condicion_iva: 'responsable_inscripto',
      actividad: 'CONSTRUCCIÓN DE EDIFICIOS RESIDENCIALES',
    });
    expect(r.persona.domicilio_texto).toBe('AV 25 DE MAYO 1234, Formosa, Formosa (CP 3600)');
    const segunda = await consultarPadron(ctx, '30700000008');
    expect(segunda.desde_cache).toBe(true);
    expect(fake.estado.llamadas.filter(l => l === 'padron:30700000008')).toHaveLength(1);
    await consultarPadron(ctx, '30700000008', true);   // forzar
    expect(fake.estado.llamadas.filter(l => l === 'padron:30700000008')).toHaveLength(2);
  });

  it('una monotributista y una persona sin impuestos', async () => {
    const m = (await consultarPadron(ctx, '27288887778')).persona;
    expect(m).toMatchObject({ nombre: 'Maria de los Angeles', apellido: 'Gomez', condicion_iva: 'monotributista', monotributo_categoria: 'D LOCACIONES DE SERVICIO' });
    const p = (await consultarPadron(ctx, '20333333334')).persona;
    expect(p).toMatchObject({ nombre_completo: 'Perez Juan Carlos', condicion_iva: 'consumidor_final' });
  });

  it('CUIT inválido o inexistente dan un error claro', async () => {
    await expect(consultarPadron(ctx, '20111111113')).rejects.toMatchObject({ codigos: ['cuit_invalido'] });
    await expect(consultarPadron(ctx, '20111111112')).rejects.toMatchObject({ codigos: ['no_existe'] });
  });
});
