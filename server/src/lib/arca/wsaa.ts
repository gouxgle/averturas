import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { db } from '../../db.js';
import { urlServicio, SERVICIO_WSAA, type Ambiente } from './endpoints.js';
import { leerCredenciales } from './secretos.js';
import { llamarSoap, ArcaError, escXml } from './soap.js';

// WSAA: ticket de acceso (token + sign) por servicio. Dura 12 h y pedir otro mientras el
// anterior sigue vigente da "coe.alreadyAuthenticated", así que se cachea en arca_tokens y
// se renueva recién cuando le quedan menos de 10 minutos. Un advisory lock evita que dos
// pedidos simultáneos pidan ticket a la vez.

export interface Ticket { token: string; sign: string; expira: Date }

const MARGEN_MS = 10 * 60 * 1000;
const parserInterno = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false });

const isoSinMs = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Pedido de ticket (TRA) firmado en CMS "attached" (ARCA rechaza el modo detached). */
export function firmarTRA(servicio: string, cred: { clave: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate }, ahora = new Date()): string {
  const tra =
    `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${isoSinMs(new Date(ahora.getTime() - 10 * 60 * 1000))}</generationTime>` +
    `<expirationTime>${isoSinMs(new Date(ahora.getTime() + 10 * 60 * 1000))}</expirationTime>` +
    `</header><service>${escXml(servicio)}</service></loginTicketRequest>`;
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cred.cert);
  p7.addSigner({
    key: cred.clave,
    certificate: cred.cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: ahora as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function pedirTicket(ambiente: Ambiente, servicio: string): Promise<Ticket> {
  const cred = await leerCredenciales(ambiente);
  if (!cred) throw new ArcaError(`No hay certificado de ${ambiente} cargado`, ['sin_certificado']);
  if (cred.info.vencimiento.getTime() < Date.now()) {
    throw new ArcaError('El certificado de ARCA está vencido: hay que renovarlo', ['cert_vencido']);
  }
  const cms = firmarTRA(servicio, cred);
  let body: Record<string, unknown>;
  try {
    ({ body } = await llamarSoap({
      ambiente, servicio: 'wsaa', metodo: 'loginCms', url: urlServicio(ambiente, 'wsaa'), soapAction: '',
      namespaces: 'xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"',
      cuerpo: `<wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms>`,
    }));
  } catch (e) {
    if (e instanceof ArcaError && e.codigos.includes('alreadyAuthenticated')) {
      throw new ArcaError(
        'ARCA dice que ya hay un ticket vigente pedido desde otro lado con este certificado. ' +
        'Se libera solo en unas horas (máximo 12).', e.codigos);
    }
    if (e instanceof ArcaError && e.codigos.some(c => /cms\.|cert\./.test(c))) {
      throw new ArcaError(`ARCA rechazó el certificado: ${e.message}. ¿Es del ambiente correcto y está asociado al servicio?`, e.codigos);
    }
    throw e;
  }
  const xml = String((body.loginCmsResponse as Record<string, unknown> | undefined)?.loginCmsReturn ?? '');
  const r = parserInterno.parse(xml) as {
    loginTicketResponse?: { header?: { expirationTime?: string }; credentials?: { token?: string; sign?: string } };
  };
  const t = r.loginTicketResponse;
  if (!t?.credentials?.token || !t.credentials.sign || !t.header?.expirationTime) {
    throw new ArcaError('Respuesta de WSAA sin ticket', ['wsaa_sin_ticket']);
  }
  return { token: t.credentials.token, sign: t.credentials.sign, expira: new Date(t.header.expirationTime) };
}

/** Ticket vigente para un servicio (wsfe / padron), del caché o pedido a WSAA. */
export async function obtenerTicket(ambiente: Ambiente, servicio: 'wsfe' | 'padron', cuit: string): Promise<Ticket> {
  const nombre = SERVICIO_WSAA[servicio];
  const buscar = async (q: { query: typeof db.query }) => {
    const { rows: [t] } = await q.query(
      `SELECT token, sign, expira_at FROM arca_tokens
        WHERE servicio=$1 AND ambiente=$2 AND cuit=$3 AND expira_at > now() + ($4 || ' milliseconds')::interval`,
      [nombre, ambiente, cuit, String(MARGEN_MS)]);
    return t ? { token: t.token as string, sign: t.sign as string, expira: new Date(t.expira_at) } : null;
  };
  const enCache = await buscar(db);
  if (enCache) return enCache;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`wsaa:${nombre}:${ambiente}:${cuit}`]);
    const otro = await buscar(client);  // otro pedido pudo haberlo renovado mientras esperábamos
    if (otro) { await client.query('COMMIT'); return otro; }
    const t = await pedirTicket(ambiente, nombre);
    await client.query(
      `INSERT INTO arca_tokens (servicio, ambiente, cuit, token, sign, generado_at, expira_at)
       VALUES ($1,$2,$3,$4,$5,now(),$6)
       ON CONFLICT (servicio, ambiente, cuit) DO UPDATE
         SET token=EXCLUDED.token, sign=EXCLUDED.sign, generado_at=now(), expira_at=EXCLUDED.expira_at`,
      [nombre, ambiente, cuit, t.token, t.sign, t.expira]);
    await client.query('COMMIT');
    return t;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
