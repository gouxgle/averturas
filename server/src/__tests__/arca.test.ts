import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';
import { iniciarArcaFake, emitirCertificadoDePrueba, contenidoFirmado, type EstadoFake } from './arca-fake/servidor.js';

// Conexión con ARCA contra el servidor simulado. La primera parte (clave, CSR, certificado,
// firma del TRA) no necesita base; la segunda (ticket cacheado, WSFE) usa arca_tokens y
// fiscal_eventos, así que corre solo con DATABASE_URL:
//   DATABASE_URL=… npx vitest run arca

const CUIT = '20111111112';   // distinto por archivo: los tests corren en paralelo y comparten arca_tokens
let dirSecretos: string;

beforeAll(async () => {
  dirSecretos = await fs.mkdtemp(path.join(os.tmpdir(), 'arca-test-'));
  process.env.FISCAL_SECRETS_DIR = dirSecretos;
  process.env.FISCAL_KEY_SECRET = 'clave-de-prueba-para-tests-1234';
});
afterAll(async () => {
  await fs.rm(dirSecretos, { recursive: true, force: true });
});

describe('clave, CSR y certificado', () => {
  it('genera el CSR con el formato de ARCA y guarda la clave cifrada', async () => {
    const { generarClaveYCsr } = await import('../lib/arca/secretos.js');
    const csrPem = await generarClaveYCsr({ cuit: CUIT, razonSocial: 'Prueba SA', alias: 'aberturas' });
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    const campos = csr.subject.attributes.map(a => String(a.value));
    expect(campos).toContain(`CUIT ${CUIT}`);
    expect(campos).toContain('AR');
    const guardada = await fs.readFile(path.join(dirSecretos, 'clave.pem.enc'), 'utf8');
    expect(guardada).not.toContain('PRIVATE KEY');   // nunca en claro
    const stat = await fs.stat(path.join(dirSecretos, 'clave.pem.enc'));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('acepta el .crt que corresponde a la clave y rechaza uno ajeno', async () => {
    const { leerCsr, guardarCertificado } = await import('../lib/arca/secretos.js');
    const propio = emitirCertificadoDePrueba((await leerCsr())!);
    const info = await guardarCertificado('homologacion', propio);
    expect(info.vencimiento.getTime()).toBeGreaterThan(Date.now());
    expect(info.huella).toMatch(/^[0-9a-f]{64}$/);

    const otraClave = forge.pki.rsa.generateKeyPair(1024);
    const csrAjeno = forge.pki.createCertificationRequest();
    csrAjeno.publicKey = otraClave.publicKey;
    csrAjeno.setSubject([{ name: 'commonName', value: 'otro' }]);
    csrAjeno.sign(otraClave.privateKey);
    const ajeno = emitirCertificadoDePrueba(forge.pki.certificationRequestToPem(csrAjeno));
    await expect(guardarCertificado('homologacion', ajeno)).rejects.toThrow(/no corresponde/);
    await expect(guardarCertificado('homologacion', 'basura')).rejects.toThrow(/no es un certificado/);
  });

  it('firma el TRA en CMS attached con el servicio pedido', async () => {
    const { leerCredenciales } = await import('../lib/arca/secretos.js');
    const { firmarTRA } = await import('../lib/arca/wsaa.js');
    const cred = (await leerCredenciales('homologacion'))!;
    const cms = firmarTRA('wsfe', cred);
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(cms))) as forge.pkcs7.PkcsSignedData;
    const tra = contenidoFirmado(p7);
    expect(tra).toContain('<service>wsfe</service>');
    expect(p7.certificates).toHaveLength(1);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('WSAA + WSFE contra ARCA simulado', () => {
  let fake: { url: string; estado: EstadoFake; cerrar: () => Promise<void> };
  const ctx = { ambiente: 'homologacion' as const, cuit: CUIT };

  beforeAll(async () => {
    fake = await iniciarArcaFake();
    process.env.ARCA_FAKE_URL = fake.url;
    const { db } = await import('../db.js');
    await db.query(`DELETE FROM arca_tokens WHERE cuit=$1`, [CUIT]);
  });
  afterAll(async () => {
    const { db } = await import('../db.js');
    await db.query(`DELETE FROM arca_tokens WHERE cuit=$1`, [CUIT]);
    await db.query(`DELETE FROM fiscal_eventos WHERE ambiente='homologacion' AND created_at > now() - interval '10 minutes'`);
    delete process.env.ARCA_FAKE_URL;
    await fake.cerrar();
    await db.end();
  });

  it('FEDummy responde y trae la hora del servidor', async () => {
    const { feDummy } = await import('../lib/arca/wsfe.js');
    const r = await feDummy(ctx);
    expect([r.appServer, r.dbServer, r.authServer]).toEqual(['OK', 'OK', 'OK']);
    expect(r.fechaServidor).toBeInstanceOf(Date);
  });

  it('pide el ticket una sola vez y lo reutiliza (también con pedidos simultáneos)', async () => {
    const { ultimoAutorizado } = await import('../lib/arca/wsfe.js');
    fake.estado.ultimos.set('3-6', 41);
    const nros = await Promise.all([1, 2, 3].map(() => ultimoAutorizado(ctx, 3, 6)));
    expect(nros).toEqual([41, 41, 41]);
    expect(await ultimoAutorizado(ctx, 3, 1)).toBe(0);
    expect(fake.estado.logins).toBe(1);
  });

  it('lista puntos de venta, tipos de comprobante y condiciones de IVA', async () => {
    const { puntosDeVenta, tiposComprobante, condicionesIvaReceptor } = await import('../lib/arca/wsfe.js');
    expect(await puntosDeVenta(ctx)).toEqual([{ numero: 3, emisionTipo: 'CAE - RECE', bloqueado: false, baja: null }]);
    expect((await tiposComprobante(ctx)).map(t => t.id)).toEqual([1, 2, 3, 6, 7, 8]);
    expect((await condicionesIvaReceptor(ctx)).find(c => c.id === 5)?.desc).toBe('Consumidor Final');
  });

  it('convierte <Errors> de ARCA en ArcaError con el código', async () => {
    const { ultimoAutorizado } = await import('../lib/arca/wsfe.js');
    fake.estado.errores.FECompUltimoAutorizado = { code: '11002', msg: 'El punto de venta no se encuentra habilitado' };
    await expect(ultimoAutorizado(ctx, 99, 6)).rejects.toMatchObject({ codigos: ['11002'] });
  });

  it('marca como incierto un timeout y deja registro del evento', async () => {
    const { ultimoAutorizado } = await import('../lib/arca/wsfe.js');
    fake.estado.demora.FECompUltimoAutorizado = 500;
    await expect(ultimoAutorizado({ ...ctx, timeoutMs: 100 }, 3, 6))
      .rejects.toMatchObject({ codigos: ['timeout'], incierto: true });
    const { db } = await import('../db.js');
    // Filtrado por CUIT: otros archivos de test registran eventos en paralelo.
    const { rows: [ev] } = await db.query(
      `SELECT error_codigo, request FROM fiscal_eventos
        WHERE metodo = 'FECompUltimoAutorizado' AND request LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`%<ar:Cuit>${CUIT}</ar:Cuit>%`]);
    expect(ev.error_codigo).toBe('timeout');
    expect(ev.request).toContain('<ar:Token>***<');   // el token no queda en el registro
  });

  it('consultar un comprobante inexistente devuelve null (error 602)', async () => {
    const { consultarComprobante } = await import('../lib/arca/wsfe.js');
    expect(await consultarComprobante(ctx, 3, 6, 999)).toBeNull();
  });
});
