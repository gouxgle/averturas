// Envío de WhatsApp vía Evolution API — convención del proyecto, nunca wa.me.
// Extraído de routes/clientes.ts (POST /:id/enviar-mensaje-whatsapp) para
// reusarlo desde otras rutas (oportunidades) sin duplicar la normalización
// del número argentino ni el manejo de errores de Evolution.

export function normalizarNumeroAR(telefono: string): string {
  const digits = telefono.replace(/\D/g, '');
  if (digits.startsWith('549') && digits.length >= 13) return digits;
  if (digits.startsWith('54') && digits.length >= 12) return `549${digits.slice(2)}`;
  if (digits.startsWith('0') && digits.length >= 11) return `549${digits.slice(1)}`;
  return `549${digits}`;
}

export type EnvioWhatsappResultado =
  | { ok: true; numero: string }
  | { ok: false; error: string; status: number };

export async function enviarWhatsapp(telefono: string, mensaje: string): Promise<EnvioWhatsappResultado> {
  const numero = normalizarNumeroAR(telefono);

  const evoUrl  = process.env.EVOLUTION_API_URL;
  const evoKey  = process.env.EVOLUTION_API_KEY;
  const evoInst = process.env.EVOLUTION_INSTANCE;
  if (!evoUrl || !evoKey || !evoInst)
    return { ok: false, error: 'Evolution API no configurada (faltan env vars)', status: 500 };

  const resp = await fetch(`${evoUrl}/message/sendText/${evoInst}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    body: JSON.stringify({ number: numero, text: mensaje }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[whatsapp] Evolution API error:', resp.status, errText);
    try {
      const errJson = JSON.parse(errText);
      const msgs: Array<{ exists?: boolean; number?: string }> = errJson?.response?.message ?? [];
      const noExiste = msgs.find(m => m.exists === false);
      if (noExiste) return { ok: false, error: `El número ${noExiste.number ?? numero} no está en WhatsApp.`, status: 422 };
    } catch { /* no JSON */ }
    return { ok: false, error: `Error al enviar WhatsApp (${resp.status})`, status: 502 };
  }

  return { ok: true, numero };
}

/**
 * Envía un PDF como documento adjunto (Evolution `sendMedia`). Centraliza lo que
 * estaba inline en recibos.ts y clientes.ts (estado de cuenta) — mismo payload y
 * mismo manejo de errores que `enviarWhatsapp`.
 */
export async function enviarWhatsappPdf(
  telefono: string, pdf: Buffer, fileName: string, caption: string,
): Promise<EnvioWhatsappResultado> {
  const numero = normalizarNumeroAR(telefono);

  const evoUrl  = process.env.EVOLUTION_API_URL;
  const evoKey  = process.env.EVOLUTION_API_KEY;
  const evoInst = process.env.EVOLUTION_INSTANCE;
  if (!evoUrl || !evoKey || !evoInst)
    return { ok: false, error: 'Evolution API no configurada (faltan env vars)', status: 500 };

  const resp = await fetch(`${evoUrl}/message/sendMedia/${evoInst}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    body: JSON.stringify({
      number: numero,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: pdf.toString('base64'),
      fileName,
      caption,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[whatsapp-pdf] Evolution API error:', resp.status, errText);
    try {
      const errJson = JSON.parse(errText);
      const msgs: Array<{ exists?: boolean; number?: string }> = errJson?.response?.message ?? [];
      const noExiste = msgs.find(m => m.exists === false);
      if (noExiste) return { ok: false, error: `El número ${noExiste.number ?? numero} no está registrado en WhatsApp.`, status: 422 };
    } catch { /* no JSON */ }
    return { ok: false, error: `Error al enviar WhatsApp (${resp.status})`, status: 502 };
  }

  return { ok: true, numero };
}

/**
 * Envía una imagen ya subida (URL de /uploads) como mensaje aparte. Evolution manda
 * un archivo por request, así que las fotos de un reclamo van de a una después del
 * texto. `APP_URL` tiene que estar definida: el proveedor abre la imagen desde afuera.
 */
export async function enviarImagenWhatsapp(telefono: string, url: string, caption: string): Promise<EnvioWhatsappResultado> {
  const numero = normalizarNumeroAR(telefono);
  const evoUrl  = process.env.EVOLUTION_API_URL;
  const evoKey  = process.env.EVOLUTION_API_KEY;
  const evoInst = process.env.EVOLUTION_INSTANCE;
  if (!evoUrl || !evoKey || !evoInst)
    return { ok: false, error: 'Evolution API no configurada (faltan env vars)', status: 500 };

  const base = (process.env.APP_URL ?? '').replace(/\/+$/, '');
  const media = url.startsWith('http') ? url : `${base}${url}`;
  if (!media.startsWith('http')) return { ok: false, error: 'APP_URL no configurada: no se pueden mandar las fotos', status: 500 };

  const resp = await fetch(`${evoUrl}/message/sendMedia/${evoInst}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
    body: JSON.stringify({ number: numero, mediatype: 'image', media, caption }),
  });
  if (!resp.ok) {
    console.error('[whatsapp-imagen] Evolution API error:', resp.status, await resp.text().catch(() => ''));
    return { ok: false, error: `Error al enviar la imagen (${resp.status})`, status: 502 };
  }
  return { ok: true, numero };
}
