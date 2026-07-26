import nodemailer from 'nodemailer';

// Envío de mails vía SMTP (Gmail) — requiere una "Contraseña de aplicación" de Google,
// la contraseña normal de la cuenta no funciona por SMTP desde 2022.
// Sin SMTP_USER/SMTP_PASS configuradas: los emails se omiten silenciosamente (no rompe nada).
let _transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: false, // STARTTLS en el puerto 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

async function sendMail(p: { to: string; subject: string; html: string; fromNombre: string; replyTo?: string }) {
  const transporter = getTransporter();
  if (!transporter) return;
  const info = await transporter.sendMail({
    from:    `"${p.fromNombre}" <${process.env.SMTP_USER}>`,
    to:      p.to,
    replyTo: process.env.SMTP_REPLY_TO || p.replyTo || undefined,
    subject: p.subject,
    html:    p.html,
  });
  console.log('[email] Enviado:', JSON.stringify({
    to: p.to, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response,
  }));
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

  await sendMail({
    to:      p.to,
    subject: `✅ Confirmaste tu pedido ${p.proformaNumero} — ${p.empresaNombre}`,
    html:    baseLayout(p.empresaNombre, content),
    fromNombre: p.empresaNombre,
  });
}

export async function sendProformaRechazada(p: EmailProformaRechazadaParams) {
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

  await sendMail({
    to:      p.to,
    subject: `Recibimos tu respuesta — ${p.proformaNumero}`,
    html:    baseLayout(p.empresaNombre, content),
    fromNombre: p.empresaNombre,
  });
}

interface EmailProformaCompartidaParams {
  to: string;
  clienteNombre: string;
  proformaNumero: string;
  total: number;
  url: string;
  empresaNombre: string;
  empresaTelefono: string | null;
}

export async function sendProformaCompartida(p: EmailProformaCompartidaParams) {
  const content = `
    <tr>
      <td style="padding:36px 32px;">
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Hola, <strong>${p.clienteNombre}</strong></p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:900;color:${NAVY};">Te enviamos tu presupuesto</h1>

        <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:13px;color:#64748b;font-weight:700;">Presupuesto</div>
                <div style="font-size:22px;font-weight:900;color:${NAVY};">${p.proformaNumero}</div>
              </td>
              <td align="right">
                <div style="font-size:11px;color:#6b7280;">Total</div>
                <div style="font-size:20px;font-weight:900;color:${NAVY};">${fmtM(p.total)}</div>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
          Podés revisar el detalle completo y aprobarlo online desde el siguiente enlace:
        </p>

        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr>
            <td style="border-radius:8px;background:${NAVY};">
              <a href="${p.url}" style="display:inline-block;padding:14px 28px;color:white;font-size:14px;font-weight:700;text-decoration:none;">Ver presupuesto →</a>
            </td>
          </tr>
        </table>

        ${p.empresaTelefono ? `<p style="margin:0;font-size:13px;color:#9ca3af;">¿Consultas? Escribinos por WhatsApp al <strong>${p.empresaTelefono}</strong></p>` : ''}
      </td>
    </tr>`;

  await sendMail({
    to:      p.to,
    subject: `Tu presupuesto ${p.proformaNumero} — ${p.empresaNombre}`,
    html:    baseLayout(p.empresaNombre, content),
    fromNombre: p.empresaNombre,
  });
}

// ── Notificaciones internas (email a la empresa) ──────────────────────────────

interface EmailEmpresaAceptacionParams {
  to: string;
  clienteNombre: string;
  proformaNumero: string;
  total: number;
  empresaNombre: string;
}

interface EmailEmpresaRechazoParams {
  to: string;
  clienteNombre: string;
  proformaNumero: string;
  motivo: string | null;
  comentario: string | null;
  empresaNombre: string;
}

export async function sendEmpresaAceptacion(p: EmailEmpresaAceptacionParams) {
  const content = `
    <tr>
      <td style="padding:32px;">
        <div style="background:#f0fdf4;border-left:4px solid ${GREEN};padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
          <div style="font-size:13px;color:#15803d;font-weight:700;margin-bottom:4px;">✅ Proforma aceptada por el cliente</div>
          <div style="font-size:22px;font-weight:900;color:${NAVY};">${p.proformaNumero}</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;">
          <tr><td style="padding:6px 0;"><strong>Cliente:</strong></td><td>${p.clienteNombre}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Total:</strong></td><td style="font-weight:900;color:${NAVY};">${fmtM(p.total)}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Ingresá al sistema para continuar con la operación.</p>
      </td>
    </tr>`;

  await sendMail({
    to:      p.to,
    subject: `✅ ${p.clienteNombre} aceptó la proforma ${p.proformaNumero}`,
    html:    baseLayout(p.empresaNombre, content),
    fromNombre: p.empresaNombre,
  });
}

export async function sendEmpresaRechazo(p: EmailEmpresaRechazoParams) {
  const content = `
    <tr>
      <td style="padding:32px;">
        <div style="background:#fef2f2;border-left:4px solid ${RED};padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
          <div style="font-size:13px;color:#991b1b;font-weight:700;margin-bottom:4px;">❌ Proforma rechazada por el cliente</div>
          <div style="font-size:22px;font-weight:900;color:${NAVY};">${p.proformaNumero}</div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;">
          <tr><td style="padding:6px 0;width:100px;"><strong>Cliente:</strong></td><td>${p.clienteNombre}</td></tr>
          ${p.motivo    ? `<tr><td style="padding:6px 0;"><strong>Motivo:</strong></td><td>${p.motivo}</td></tr>` : ''}
          ${p.comentario? `<tr><td style="padding:6px 0;"><strong>Comentario:</strong></td><td style="font-style:italic;">${p.comentario}</td></tr>` : ''}
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Ingresá al sistema para hacer seguimiento o modificar la propuesta.</p>
      </td>
    </tr>`;

  await sendMail({
    to:      p.to,
    subject: `❌ ${p.clienteNombre} rechazó la proforma ${p.proformaNumero}`,
    html:    baseLayout(p.empresaNombre, content),
    fromNombre: p.empresaNombre,
  });
}
