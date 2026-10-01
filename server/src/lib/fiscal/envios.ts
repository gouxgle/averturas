import { db } from '../../db.js';
import { enviarWhatsappPdf } from '../whatsapp.js';
import { sendCompra, emailDisponible } from '../../email.js';
import { encolar } from '../cola.js';
import { generarPDFComprobante } from './pdfComprobante.js';
import { CBTE_DESC } from './calculo.js';

// Envío del comprobante al cliente (PDF adjunto) por WhatsApp o mail. Se intenta en el
// momento; si falla queda en la cola y se reintenta solo. Cada intento queda en
// fiscal_eventos (historial de envíos del comprobante).

export type Canal = 'whatsapp' | 'email';

export interface ResultadoEnvio { ok: boolean; destino: string; error?: string; reintenta?: boolean }

const fmt$ = (n: number | string) => `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function registrarEnvio(cbteId: string, canal: Canal, destino: string, ok: boolean, error: string | null, usuarioId: string | null) {
  await db.query(
    `INSERT INTO fiscal_eventos (tipo, ok, error_mensaje, request, comprobante_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [canal === 'whatsapp' ? 'envio_whatsapp' : 'envio_email', ok, error, destino, cbteId, usuarioId]);
}

/** Destino por defecto: teléfono o mail del cliente. */
export async function destinoPorDefecto(cbteId: string, canal: Canal): Promise<string | null> {
  const { rows: [r] } = await db.query(
    `SELECT cl.telefono, cl.email FROM comprobantes c LEFT JOIN clientes cl ON cl.id = c.cliente_id WHERE c.id = $1`, [cbteId]);
  return (canal === 'whatsapp' ? r?.telefono : r?.email) || null;
}

export async function enviarComprobante(cbteId: string, canal: Canal, destinoPedido: string | null, usuarioId: string | null,
  opts: { desdeCola?: boolean } = {}): Promise<ResultadoEnvio> {
  const destino = (destinoPedido?.trim() || await destinoPorDefecto(cbteId, canal) || '').trim();
  if (!destino) return { ok: false, destino: '', error: canal === 'whatsapp' ? 'El cliente no tiene teléfono cargado' : 'El cliente no tiene mail cargado' };
  if (canal === 'email' && !emailDisponible()) return { ok: false, destino, error: 'El envío de mails no está configurado en el servidor' };

  const gen = await generarPDFComprobante(cbteId, 1);
  if (!gen) return { ok: false, destino, error: 'Comprobante no encontrado' };
  const { c, empresa, emisor } = gen.datos;
  if (c.estado !== 'autorizado') return { ok: false, destino, error: 'Solo se envían comprobantes autorizados por ARCA' };

  const tipo = CBTE_DESC[c.cbte_tipo] ?? 'Comprobante';
  const numero = `${String(c.punto_venta).padStart(5, '0')}-${String(c.numero).padStart(8, '0')}`;
  const nombreEmpresa = emisor.razon_social || empresa?.nombre || 'César Brítez Aberturas';
  const saludo = c.receptor_doc_tipo === 99 ? 'Hola' : `Hola ${String(c.receptor_nombre).split(' ').slice(-1)[0]}`;
  const mensaje = `${saludo}, te enviamos tu *${tipo} ${numero}* por *${fmt$(c.imp_total)}*. ¡Gracias por elegirnos!`;

  let error: string | null = null;
  try {
    if (canal === 'whatsapp') {
      const r = await enviarWhatsappPdf(destino, gen.pdf, gen.nombre, mensaje);
      if (!r.ok) error = r.error;
    } else {
      const ok = await sendCompra({
        to: destino, asunto: `${tipo} ${numero} — ${nombreEmpresa}`, mensaje, pdf: gen.pdf, pdfNombre: gen.nombre,
        empresaNombre: nombreEmpresa, empresaTelefono: empresa?.telefono ?? null,
      });
      if (!ok) error = 'El envío de mails no está configurado en el servidor';
    }
  } catch (e) {
    error = (e as Error).message || String(e);
  }

  await registrarEnvio(cbteId, canal, destino, !error, error, usuarioId);
  if (!error) return { ok: true, destino };
  // Falla transitoria (red, Evolution caído): se reintenta solo. La cola ya reintenta lo suyo.
  const reintenta = !opts.desdeCola && !/no (está )?configurad|no tiene/i.test(error);
  if (reintenta) await encolar('enviar_comprobante', { id: cbteId, canal, destino, usuario_id: usuarioId }, { enSegundos: 120, maxIntentos: 6 });
  return { ok: false, destino, error, reintenta };
}
