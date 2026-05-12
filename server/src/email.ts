import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const NAVY  = '#031d49';
const RED   = '#e31e24';
const GREEN = '#16a34a';

interface EmailProformaAceptadaParams {
  to: string;
  clienteNombre: string;
  proformaNumero: string;
  total: number;
  empresaNombre: string;
  empresaTelefono: string | null;
  empresaEmail: string | null;
  appUrl: string;
}

interface EmailProformaRechazadaParams {
  to: string;
  clienteNombre: string;
  proformaNumero: string;
  motivo: string | null;
  comentario: string | null;
  empresaNombre: string;
  empresaTelefono: string | null;
  appUrl: string;
}

const fmtM = (n: number) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

function baseLayout(empresaNombre: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${empresaNombre}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:${NAVY};padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="color:white;font-size:20px;font-weight:900;letter-spacing:0.5px;">${empresaNombre}</div>
                </td>
                <td align="right">
                  <div style="color:${RED};font-size:22px;font-weight:900;letter-spacing:2px;">PROFORMA</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Content -->
        ${content}

        <!-- Footer -->
        <tr>
          <td style="background:${NAVY};padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#93c5fd;font-size:12px;">${empresaNombre} · Este es un mensaje automático, no respondas este email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendProformaAceptada(p: EmailProformaAceptadaParams) {
  const resend = getResend();
  if (!resend) return;

  const content = `
    <tr>
      <td style="padding:36px 32px;">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Hola, <strong>${p.clienteNombre}</strong></p>
        <h1 style="margin:0 0 24px;font-size:26px;font-weight:900;color:${NAVY};">¡Confirmaste tu pedido!</h1>

        <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;vertical-align:middle;">
                <div style="width:32px;height:32px;background:${GREEN};border-radius:50%;text-align:center;line-height:32px;font-size:18px;">✓</div>
              </td>
              <td style="padding-left:12px;">
                <div style="font-size:13px;color:#15803d;font-weight:700;">Proforma aceptada</div>
                <div style="font-size:22px;font-weight:900;color:${NAVY};">${p.proformaNumero}</div>
              </td>
              <td align="right">
                <div style="font-size:11px;color:#6b7280;">Total</div>
                <div style="font-size:20px;font-weight:900;color:${NAVY};">${fmtM(p.total)}</div>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
          Recibimos la confirmación de tu pedido. Nos pondremos en contacto a la brevedad para coordinar los próximos pasos.
        </p>

        <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.6;">
          Si tenés alguna consulta, podés comunicarte con nosotros:
        </p>

        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          ${p.empresaTelefono ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151;">📞 <strong>${p.empresaTelefono}</strong></td></tr>` : ''}
          ${p.empresaEmail    ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151;">✉️ <strong>${p.empresaEmail}</strong></td></tr>`    : ''}
        </table>

        <p style="margin:0;font-size:13px;color:#9ca3af;">
          ¡Gracias por confiar en ${p.empresaNombre}!
        </p>
      </td>
    </tr>`;

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? `${p.empresaNombre} <onboarding@resend.dev>`,
    to:   p.to,
    subject: `✅ Confirmaste tu pedido ${p.proformaNumero} — ${p.empresaNombre}`,
    html:    baseLayout(p.empresaNombre, content),
  });
}

export async function sendProformaRechazada(p: EmailProformaRechazadaParams) {
  const resend = getResend();
  if (!resend) return;

  const content = `
    <tr>
      <td style="padding:36px 32px;">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Hola, <strong>${p.clienteNombre}</strong></p>
        <h1 style="margin:0 0 24px;font-size:26px;font-weight:900;color:${NAVY};">Recibimos tu respuesta</h1>

        <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;vertical-align:middle;">
                <div style="width:32px;height:32px;background:${RED};border-radius:50%;text-align:center;line-height:32px;font-size:18px;color:white;">✕</div>
              </td>
              <td style="padding-left:12px;">
                <div style="font-size:13px;color:#991b1b;font-weight:700;">Proforma no aceptada</div>
                <div style="font-size:22px;font-weight:900;color:${NAVY};">${p.proformaNumero}</div>
              </td>
            </tr>
          </table>
          ${p.motivo ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #fca5a5;">
            <div style="font-size:12px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Motivo indicado</div>
            <div style="font-size:14px;color:#374151;">${p.motivo}</div>
            ${p.comentario ? `<div style="font-size:13px;color:#6b7280;margin-top:6px;font-style:italic;">${p.comentario}</div>` : ''}
          </div>` : ''}
        </div>

        <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
          Entendemos. Si en algún momento querés retomar la propuesta o necesitás algo diferente, estamos a tu disposición.
        </p>

        ${p.empresaTelefono ? `<p style="margin:0;font-size:14px;color:#374151;">Podés contactarnos por WhatsApp: <strong>${p.empresaTelefono}</strong></p>` : ''}
      </td>
    </tr>`;

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? `${p.empresaNombre} <onboarding@resend.dev>`,
    to:   p.to,
    subject: `Recibimos tu respuesta — ${p.proformaNumero}`,
    html:    baseLayout(p.empresaNombre, content),
  });
}
