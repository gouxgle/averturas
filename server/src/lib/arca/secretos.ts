import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import forge from 'node-forge';
import type { Ambiente } from './endpoints.js';

// Clave privada y certificados de ARCA. Viven en disco, FUERA de uploads/ (que se sirve
// público sin login): FISCAL_SECRETS_DIR, por defecto ./secrets/arca (volumen en Docker).
// La clave se guarda cifrada (AES-256-GCM) con FISCAL_KEY_SECRET; nunca sale del servidor:
// a ARCA viaja solo el CSR (clave pública) y ARCA devuelve el .crt.

const dir = () => process.env.FISCAL_SECRETS_DIR ?? path.resolve('secrets/arca');
const archivoClave = () => path.join(dir(), 'clave.pem.enc');
const archivoCsr = () => path.join(dir(), 'solicitud.csr');
const archivoCert = (amb: Ambiente) => path.join(dir(), `certificado-${amb}.pem`);

function claveCifrado(): Buffer {
  const secreto = process.env.FISCAL_KEY_SECRET;
  if (!secreto || secreto.length < 16) {
    throw new Error('Falta FISCAL_KEY_SECRET (mínimo 16 caracteres) para proteger la clave de ARCA');
  }
  return crypto.createHash('sha256').update(secreto).digest();
}

function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', claveCifrado(), iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), datos].map(b => b.toString('base64')).join('.');
}

function descifrar(guardado: string): string {
  const [iv, tag, datos] = guardado.trim().split('.').map(p => Buffer.from(p, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', claveCifrado(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(datos), d.final()]).toString('utf8');
}

async function escribirSeguro(archivo: string, contenido: string) {
  await fs.mkdir(dir(), { recursive: true, mode: 0o700 });
  await fs.writeFile(archivo, contenido, { mode: 0o600 });
}

export interface DatosCsr { cuit: string; razonSocial: string; alias: string }

/** Genera un par de claves RSA 2048 nuevo y el CSR para subir a ARCA. Pisa la clave anterior. */
export async function generarClaveYCsr(d: DatosCsr): Promise<string> {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const clave = forge.pki.privateKeyFromPem(privateKey);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = forge.pki.setRsaPublicKey(clave.n, clave.e);
  // Formato que pide ARCA: C=AR, O=razón social, CN=alias, serialNumber="CUIT nnnnnnnnnnn".
  csr.setSubject([
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: d.razonSocial },
    { name: 'commonName', value: d.alias },
    { type: '2.5.4.5', value: `CUIT ${d.cuit}` },
  ]);
  csr.sign(clave, forge.md.sha256.create());
  const csrPem = forge.pki.certificationRequestToPem(csr);
  await escribirSeguro(archivoClave(), cifrar(privateKey));
  await escribirSeguro(archivoCsr(), csrPem);
  return csrPem;
}

export async function leerCsr(): Promise<string | null> {
  return fs.readFile(archivoCsr(), 'utf8').catch(() => null);
}

export interface InfoCertificado { subject: string; vencimiento: Date; desde: Date; huella: string }

function infoDe(cert: forge.pki.Certificate, pem: string): InfoCertificado {
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
  return {
    subject: cert.subject.attributes.map(a => `${a.shortName ?? a.name ?? a.type}=${a.value}`).join(', '),
    vencimiento: cert.validity.notAfter,
    desde: cert.validity.notBefore,
    huella: crypto.createHash('sha256').update(der).digest('hex'),
  };
}

/**
 * Guarda el .crt que devolvió ARCA para un ambiente. Verifica que corresponda a la clave
 * generada acá (misma clave pública) y que esté vigente.
 */
export async function guardarCertificado(ambiente: Ambiente, pem: string): Promise<InfoCertificado> {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(pem.trim());
  } catch {
    throw new Error('El archivo no es un certificado válido (se espera el .crt en formato PEM que entrega ARCA)');
  }
  const clave = await leerClave();
  if (!clave) throw new Error('Primero hay que generar la solicitud (CSR): no hay clave privada');
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  if (pub.n.compareTo(clave.n) !== 0 || pub.e.compareTo(clave.e) !== 0) {
    throw new Error('El certificado no corresponde a la clave de este sistema (¿se generó con otra solicitud?)');
  }
  const info = infoDe(cert, pem);
  if (info.vencimiento.getTime() < Date.now()) throw new Error('El certificado está vencido');
  await escribirSeguro(archivoCert(ambiente), pem.trim() + '\n');
  return info;
}

async function leerClave(): Promise<forge.pki.rsa.PrivateKey | null> {
  const guardada = await fs.readFile(archivoClave(), 'utf8').catch(() => null);
  if (!guardada) return null;
  return forge.pki.privateKeyFromPem(descifrar(guardada)) as forge.pki.rsa.PrivateKey;
}

export interface Credenciales { clave: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate; info: InfoCertificado }

/** Clave + certificado listos para firmar el pedido de token. null si falta alguno. */
export async function leerCredenciales(ambiente: Ambiente): Promise<Credenciales | null> {
  const [clave, pem] = await Promise.all([
    leerClave(),
    fs.readFile(archivoCert(ambiente), 'utf8').catch(() => null),
  ]);
  if (!clave || !pem) return null;
  const cert = forge.pki.certificateFromPem(pem);
  return { clave, cert, info: infoDe(cert, pem) };
}
