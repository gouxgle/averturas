import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const NAVY = '#031d49';
const RED  = '#e31e24';

const fmt = (n: number) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Maneja tanto strings ISO como objetos Date devueltos por pg para columnas DATE
const fmtFecha = (iso: string | Date | unknown) => {
  try {
    const isoStr = iso instanceof Date ? iso.toISOString() : String(iso);
    return new Date(isoStr.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(iso); }
};

/**
 * Renderiza un HTML a PDF A4 con el Chromium del sistema. Compartido por todos los
 * generadores (antes cada uno lanzaba su propio browser con los mismos parámetros).
 */
async function renderPDF(html: string): Promise<Buffer> {
  const executablePath = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium-browser';
  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '18mm', bottom: '12mm', left: '18mm' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/** Logo embebido en base64 (Puppeteer no tiene red hacia el propio servidor). */
function logoDataURI(archivo: 'logo2.png' | 'logochico.png'): string | null {
  try {
    return `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), 'public', archivo)).toString('base64')}`;
  } catch { return null; }
}

const PAGO_LABEL: Record<string, string> = {
  efectivo:        'Efectivo',
  transferencia:   'Transferencia bancaria',
  cheque:          'Cheque',
  tarjeta_debito:  'Tarjeta de debito',
  tarjeta_credito: 'Tarjeta de credito',
  mercadopago:     'MercadoPago',
  otro:            'Otro',
};

export interface EmpresaPDF {
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}

interface ClientePDF {
  nombre: string | null; apellido: string | null; razon_social: string | null;
  tipo_persona: string; documento_nro: string | null;
  direccion: string | null; localidad: string | null;
  telefono: string | null; email: string | null;
}

interface ItemPDF {
  id?: string; descripcion: string; cantidad: number; monto: number; producto_nombre: string | null;
}

interface CompromisoPDF {
  monto: number; fecha_vencimiento: string; tipo: string;
}

export interface ReciboPDF {
  numero: string; fecha: string | Date; estado: string;
  forma_pago: string; referencia_pago: string | null;
  concepto: string | null; notas: string | null; monto_total: number;
  descuento_pct: number; monto_lista: number; monto_descuento: number;
  cliente: ClientePDF;
  operacion: { id?: string; numero: string; precio_total: number } | null;
  remito: { id?: string; numero: string } | null;
  visita_tecnica?: { id: string; numero: string; fecha_visita: string | Date | null; cobro_estado: string } | null;
  items: ItemPDF[];
  created_by_nombre: string | null;
  cobrado_operacion: number;
  total_descuentos_operacion: number;
  compromiso: CompromisoPDF | null;
  /** Última revisión enviada al cliente de la proforma vinculada, si tiene alguna. */
  proforma_revision?: number | null;
  /** Desglose cuando se cobró con varios medios. Vacío = un solo medio (forma_pago). */
  pagos?: { forma_pago: string; monto: number; referencia: string | null }[] | null;
}

function buildHTML(recibo: ReciboPDF, empresa: EmpresaPDF): string {
  const cl = recibo.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';

  let logoTag = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo2.png');
    const logoData = fs.readFileSync(logoPath);
    logoTag = `<img src="data:image/png;base64,${logoData.toString('base64')}" alt="Logo" style="height:64px;display:block;">`;
  } catch {
    try {
      const logoPath2 = path.join(process.cwd(), 'public', 'logochico.png');
      logoTag = `<img src="data:image/png;base64,${fs.readFileSync(logoPath2).toString('base64')}" alt="Logo" style="height:60px;display:block;">`;
    } catch { /* sin logo */ }
  }

  // Firma de la empresa — PNG con fondo transparente (recortado del fondo del papel
  // en la foto original) para que se vea como tinta real sobre el documento, no como
  // un recuadro gris. Se embebe en base64: Puppeteer no tiene acceso de red al propio
  // servidor, tiene que ser un archivo local igual que el logo.
  let firmaTag = '';
  try {
    const firmaPath = path.join(process.cwd(), 'public', 'firma.png');
    const firmaData = fs.readFileSync(firmaPath);
    firmaTag = `<img src="data:image/png;base64,${firmaData.toString('base64')}" alt="Firma" style="height:49px;display:block;margin:0 auto;">`;
  } catch { /* sin firma */ }

  const montoDescuento = Number(recibo.monto_descuento ?? 0);
  const descuentoPct   = Number(recibo.descuento_pct   ?? 0);
  const montoLista     = Number(recibo.monto_lista     ?? recibo.monto_total);
  const totalDesc      = Number(recibo.total_descuentos_operacion ?? 0);

  // El recibo YA NO repite el desglose de productos del presupuesto (eso generaba
  // confusion: una tabla de items que sumaba MAS que lo cobrado en un pago parcial,
  // como si el cliente hubiera pagado esos importes). En su lugar referencia numero
  // y revision de la proforma — el desglose se consulta ahi, no en el comprobante de
  // pago. Mismo criterio que ImprimirRecibo.tsx: los dos disenos tienen que coincidir.
  const proformaNumero = recibo.operacion?.numero ? recibo.operacion.numero.replace(/^OP-/, 'PRO-') : null;
  const detalleProformaHTML = recibo.operacion ? `
    <div style="margin-bottom:20px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Detalle de proforma</div>
      <div style="font-size:13px;color:#333;">
        <strong>${proformaNumero}</strong>${recibo.proforma_revision ? ` &mdash; Rev. ${recibo.proforma_revision}` : ''}
      </div>
      <div style="font-size:10.5px;color:#888;margin-top:4px;">
        El detalle de productos y servicios esta en la proforma &mdash; este recibo certifica el pago, no lo repite.
      </div>
    </div>
  ` : '';

  // Forma(s) de pago. Con un solo medio se imprime igual que siempre; con varios se
  // lista cada uno con su monto y se cierra con la suma, para que quede claro que el
  // total del recibo es la suma de los medios y no un importe suelto.
  const pagosLista = recibo.pagos ?? [];
  const pagoCombinado = pagosLista.length > 1;
  const pagosHTML = pagoCombinado ? `
    <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Medios de pago</div>
    <table style="margin-top:3px;margin-left:auto;border-collapse:collapse;">
      ${pagosLista.map(p => `
        <tr>
          <td style="font-size:11.5px;color:#333;padding:1px 0;text-align:left;">
            ${PAGO_LABEL[p.forma_pago] ?? p.forma_pago}${p.referencia ? `<span style="color:#777;"> &middot; Ref: ${p.referencia}</span>` : ''}
          </td>
          <td style="font-size:12px;color:${NAVY};font-weight:700;font-family:monospace;padding:1px 0 1px 14px;text-align:right;white-space:nowrap;">
            ${fmt(Number(p.monto))}
          </td>
        </tr>
      `).join('')}
      <tr>
        <td style="font-size:10.5px;color:#888;padding:4px 0 0;text-align:left;border-top:1px solid #d9d9d9;">Total</td>
        <td style="font-size:12.5px;color:${NAVY};font-weight:900;font-family:monospace;padding:4px 0 0 14px;text-align:right;border-top:1px solid #d9d9d9;white-space:nowrap;">
          ${fmt(pagosLista.reduce((a, p) => a + Number(p.monto), 0))}
        </td>
      </tr>
    </table>
  ` : `
    <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Forma de pago</div>
    <div style="color:${NAVY};font-size:14px;font-weight:700;margin-top:2px;">${PAGO_LABEL[recibo.forma_pago] ?? recibo.forma_pago}</div>
    ${recibo.referencia_pago ? `<div style="color:#555;font-size:11px;margin-top:2px;">Ref: ${recibo.referencia_pago}</div>` : ''}
  `;

  // Detalle del relevamiento que se esta cobrando (sin acentos, igual que el resto del PDF server-side)
  const vt = recibo.visita_tecnica;
  const visitaHTML = vt ? `
    <div style="border:1px solid #d9d9d9;border-radius:6px;background:#fafafa;padding:10px 12px;margin-bottom:14px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Visita de Relevamiento de Datos</div>
      <div style="font-size:12px;color:#333;">
        <strong>${vt.numero}</strong>${vt.fecha_visita ? ` &middot; Fecha prevista: ${fmtFecha(vt.fecha_visita)}` : ''}
      </div>
      ${cl.direccion ? `<div style="font-size:11px;color:#666;margin-top:2px;">Domicilio: ${[cl.direccion, cl.localidad].filter(Boolean).join(', ')}</div>` : ''}
      <div style="font-size:10px;color:#888;margin-top:4px;">
        Este importe se acredita al presupuesto que se genere a partir de este relevamiento.
      </div>
    </div>
  ` : '';

  const descuentoHTML = montoDescuento > 0 ? `
    <div style="background:#f5f0ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-size:12px;color:#7c3aed;font-weight:700;">
          Bonificacion ${descuentoPct % 1 === 0 ? descuentoPct.toFixed(0) : descuentoPct.toFixed(1)}% aplicada
        </span>
        <span style="font-size:12px;color:#7c3aed;font-weight:700;">Ahorro: ${fmt(montoDescuento)}</span>
      </div>
      ${recibo.operacion ? `
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:4px;">
          <span>Total del presupuesto sin descuento</span><span>${fmt(Number(recibo.operacion.precio_total))}</span>
        </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;">
        <span>Sin bonificacion pagaria</span>
        <span style="text-decoration:line-through;color:#999;">${fmt(montoLista)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#555;margin-top:2px;">
        <span>Con bonificacion paga</span>
        <span style="font-weight:600;color:#7c3aed;">${fmt(Number(recibo.monto_total))}</span>
      </div>
    </div>
  ` : '';

  let operacionHTML = '';
  if (recibo.operacion) {
    const saldo = Math.max(0,
      Number(recibo.operacion.precio_total)
      - Number(recibo.cobrado_operacion ?? 0)
      - totalDesc
    );
    const fvStr = recibo.compromiso?.fecha_vencimiento
      ? fmtFecha(recibo.compromiso.fecha_vencimiento)
      : null;
    operacionHTML = `
      <div style="padding-top:10px;border-top:1px solid #eee;margin-bottom:20px;">
        <div style="display:flex;gap:40px;flex-wrap:wrap;">
          ${!montoDescuento ? `
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin-bottom:2px;">Total del presupuesto (referencia)</div>
              <div style="font-size:12px;font-weight:400;color:#777;">${fmt(Number(recibo.operacion.precio_total))}</div>
            </div>
          ` : ''}
          ${saldo >= 0.01 ? `
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Saldo pendiente</div>
              <div style="font-size:13px;font-weight:700;color:${RED};">${fmt(saldo)}</div>
            </div>
          ` : ''}
          ${fvStr ? `
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Se compromete a pagar el</div>
              <div style="font-size:14px;font-weight:700;color:${NAVY};">${fvStr}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const contactParts = [
    empresa.cuit ? `CUIT: ${empresa.cuit}` : null,
    empresa.telefono ? `Tel: ${empresa.telefono}` : null,
    empresa.email,
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Helvetica Neue', sans-serif; background: white; color: #333; }
</style>
</head>
<body>
<div style="max-width:750px;margin:0 auto;padding:14px 20px;background:white;min-height:273mm;display:flex;flex-direction:column;">

  <!-- Header: logo+datos izq, RECIBO der -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:12px;">
    <div style="flex:1;">
      <div style="display:flex;justify-content:center;margin-bottom:10px;">${logoTag}</div>
      <div style="height:1px;background:#e5e7eb;margin-bottom:8px;"></div>
      <div style="font-size:10.5px;color:#555;">
        ${contactParts}
      </div>
      ${empresa.direccion ? `<div style="font-size:10.5px;color:#555;margin-top:2px;">${empresa.direccion}</div>` : ''}
    </div>
    <div style="width:1px;background:#d1d5db;align-self:stretch;margin:4px 0;"></div>
    <div style="text-align:right;min-width:170px;">
      <div style="color:${RED};font-size:40px;font-weight:900;letter-spacing:3px;line-height:1;text-transform:uppercase;font-family:Georgia,serif;">Recibo</div>
      <div style="color:${NAVY};font-weight:800;font-size:16px;margin-top:8px;">${recibo.numero}</div>
      <div style="font-size:11px;color:#555;margin-top:10px;">
        <strong style="color:${NAVY};">Fecha:</strong> ${fmtFecha(recibo.fecha)}
      </div>
      ${recibo.operacion ? `<div style="font-size:11px;color:#555;margin-top:4px;">Ref. proforma: <strong style="color:${NAVY};">${proformaNumero}${recibo.proforma_revision ? ` (Rev. ${recibo.proforma_revision})` : ''}</strong></div>` : ''}
      ${recibo.remito    ? `<div style="font-size:11px;color:#555;margin-top:4px;">Ref. remito: <strong style="color:${NAVY};">${recibo.remito.numero}</strong></div>` : ''}
    </div>
  </div>

  <!-- Doble barra navy -->
  <div style="height:4px;background:${NAVY};"></div>
  <div style="height:1px;background:#3a5fad;margin-bottom:14px;"></div>

  <!-- Cliente -->
  <div style="background:#f8f9fa;border-radius:8px;padding:8px 12px;margin-bottom:14px;border-left:4px solid ${NAVY};">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Recibimos de</div>
    <div style="display:flex;align-items:baseline;gap:16px;">
      <span style="font-size:15px;font-weight:700;color:#1a1a1a;">${clienteNombre}</span>
      ${cl.documento_nro ? `<span style="font-size:11px;color:#555;">${cl.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'}: ${cl.documento_nro}</span>` : ''}
    </div>
    ${(cl.telefono || cl.email) ? `
      <div style="display:flex;gap:18px;font-size:11px;color:#555;margin-top:2px;">
        ${cl.telefono ? `<span>Tel: ${cl.telefono}</span>` : ''}
        ${cl.email    ? `<span>${cl.email}</span>` : ''}
      </div>
    ` : ''}
    ${(cl.direccion || cl.localidad) ? `
      <div style="font-size:11px;color:#555;margin-top:1px;">${[cl.direccion, cl.localidad].filter(Boolean).join(', ')}</div>
    ` : ''}
  </div>

  <!-- Monto grande -->
  <div style="border:2px solid ${NAVY};border-radius:10px;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <div>
      <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Importe de este recibo</div>
      <div style="color:${NAVY};font-size:28px;font-weight:900;font-family:monospace;margin-top:2px;">${fmt(Number(recibo.monto_total))}</div>
    </div>
    <div style="text-align:right;">
      ${pagosHTML}
    </div>
  </div>

  <!-- Concepto -->
  ${recibo.concepto ? `
    <div style="margin-bottom:12px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px;">Concepto</div>
      <div style="font-size:12px;color:#333;">${recibo.concepto}</div>
    </div>
  ` : ''}

  <!-- Visita tecnica -->
  ${visitaHTML}

  <!-- Detalle de proforma (referencia, sin desglose de items) -->
  ${detalleProformaHTML}

  <!-- Bonificacion -->
  ${descuentoHTML}

  <!-- Operacion + saldo -->
  ${operacionHTML}

  <!-- Notas -->
  ${recibo.notas ? `
    <div style="border:1px solid #ddd;border-radius:6px;padding:8px 12px;margin-bottom:16px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px;">Notas</div>
      <div style="font-size:12px;color:#444;">${recibo.notas}</div>
    </div>
  ` : ''}

  <!-- Firma -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:20px;">
    <div style="text-align:center;">
      <div style="height:42px;display:flex;align-items:flex-end;justify-content:center;">${firmaTag}</div>
      <div style="border-top:1px solid #999;padding-top:10px;font-size:11px;color:#555;">
        Firma &mdash; ${empresa.nombre}${recibo.created_by_nombre ? ` (${recibo.created_by_nombre})` : ''}
      </div>
    </div>
    <div style="text-align:center;">
      <div style="height:42px;"></div>
      <div style="border-top:1px solid #999;padding-top:8px;font-size:11px;color:#555;">
        Firma y aclaracion &mdash; Cliente
      </div>
    </div>
  </div>

  <!-- Footer navy -->
  <div style="margin-top:auto;background:${NAVY};padding:10px 24px;display:flex;justify-content:center;flex-wrap:wrap;gap:0 28px;font-size:10px;color:#bfdbfe;">
    ${empresa.telefono  ? `<span>&#128222; ${empresa.telefono}</span>` : ''}
    ${empresa.email     ? `<span>&#9993; ${empresa.email}</span>` : ''}
    ${empresa.direccion ? `<span>&#128205; ${empresa.direccion}</span>` : ''}
  </div>

</div>
</body>
</html>`;
}

// ─── Estado de Cuenta PDF ────────────────────────────────────────────────────

export interface EstadoCuentaPDF {
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; documento_nro: string | null;
    telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null;
  };
  totales: { presupuestado: number; cobrado: number; saldo: number };
  movimientos: Array<{
    fecha: string; tipo: 'cargo' | 'abono'; numero: string;
    concepto: string; monto: number; saldo: number;
  }>;
  compromisos: Array<{
    tipo: string; monto: number; fecha_vencimiento: string;
    descripcion: string | null; estado: string;
    operacion: { numero: string } | null;
    numero_cheque: string | null; banco: string | null;
  }>;
}

function buildEstadoCuentaHTML(data: EstadoCuentaPDF, empresa: EmpresaPDF): string {
  const cl = data.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';

  let logoTag = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logochico.png');
    const logoData = fs.readFileSync(logoPath);
    logoTag = `<img src="data:image/png;base64,${logoData.toString('base64')}" alt="Logo" style="height:34px;margin-right:10px;">`;
  } catch { /* sin logo */ }

  const { presupuestado, cobrado, saldo } = data.totales;
  const pct = presupuestado > 0 ? Math.min(100, Math.round(cobrado / presupuestado * 100)) : 0;
  const saldado = Math.abs(saldo) <= 0.01;
  const saldoColor = saldado ? '#059669' : '#d97706';
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const COMP_TIPO: Record<string, string> = {
    cuota: 'Cuota', cheque: 'Cheque', efectivo_futuro: 'Efectivo futuro', transferencia: 'Transferencia',
  };

  const compsPendientes = data.compromisos.filter(c => c.estado === 'pendiente' || c.estado === 'vencido');

  const movHTML = data.movimientos.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;">Cuenta Corriente</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Fecha</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Comprobante</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Concepto</th>
            <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Cargo</th>
            <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Abono</th>
            <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${data.movimientos.map((m, i) => `
            <tr style="background:${i % 2 === 0 ? 'white' : '#f8f9fa'};">
              <td style="padding:6px 8px;font-size:11px;color:#555;border-bottom:1px solid #eee;">${fmtFecha(m.fecha)}</td>
              <td style="padding:6px 8px;font-size:11px;font-weight:600;color:${m.tipo === 'abono' ? '#059669' : '#1a1a1a'};border-bottom:1px solid #eee;">${m.numero}</td>
              <td style="padding:6px 8px;font-size:11px;color:#555;border-bottom:1px solid #eee;">${m.concepto}</td>
              <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #eee;">${m.tipo === 'cargo' ? fmt(m.monto) : ''}</td>
              <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;border-bottom:1px solid #eee;color:#059669;">${m.tipo === 'abono' ? fmt(m.monto) : ''}</td>
              <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;font-weight:700;border-bottom:1px solid #eee;color:${m.saldo <= 0.01 ? '#059669' : '#1a1a1a'};">${fmt(Math.max(0, m.saldo))}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f0f0f0;">
            <td colspan="3" style="padding:6px 8px;font-size:11px;font-weight:700;color:#555;">SALDO ACTUAL</td>
            <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;font-weight:700;color:#1a1a1a;">${fmt(presupuestado)}</td>
            <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;font-weight:700;color:#059669;">${fmt(cobrado)}</td>
            <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;font-weight:700;color:${saldoColor};">${fmt(Math.max(0, saldo))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  ` : '';

  const compHTML = compsPendientes.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;">Compromisos de Pago Pendientes</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Tipo</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Vencimiento</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Detalle</th>
            <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:600;color:#555;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${compsPendientes.map((comp, i) => {
            // fecha_vencimiento es columna DATE de Postgres → pg la devuelve como objeto Date,
            // no como string (ver convención "Columnas DATE" en CLAUDE.md). Un .slice() directo
            // sobre eso tira TypeError sin capturar → 500 en cualquier cliente con compromisos
            // pendientes. Normalizar primero, igual que ya hace fmtFecha() más arriba en este archivo.
            const vencRaw = comp.fecha_vencimiento as unknown;
            const vencISO = vencRaw instanceof Date ? vencRaw.toISOString() : String(vencRaw);
            const isVencido = comp.estado === 'vencido' || (comp.estado === 'pendiente' && new Date(vencISO.slice(0, 10) + 'T12:00:00') < new Date());
            const detalle = [comp.descripcion, comp.banco, comp.numero_cheque ? 'Ch. ' + comp.numero_cheque : null, comp.operacion ? 'Op. ' + comp.operacion.numero : null].filter(Boolean).join(' · ') || '—';
            return `
              <tr style="background:${isVencido ? '#fff5f5' : i % 2 === 0 ? 'white' : '#f8f9fa'};">
                <td style="padding:6px 8px;font-size:11px;color:#555;border-bottom:1px solid #eee;">${COMP_TIPO[comp.tipo] ?? comp.tipo}</td>
                <td style="padding:6px 8px;font-size:11px;font-weight:600;color:${isVencido ? '#dc2626' : '#1a1a1a'};border-bottom:1px solid #eee;">${fmtFecha(comp.fecha_vencimiento)}${isVencido ? ' &#9888;' : ''}</td>
                <td style="padding:6px 8px;font-size:11px;color:#555;border-bottom:1px solid #eee;">${detalle}</td>
                <td style="padding:6px 8px;font-size:11px;text-align:right;font-family:monospace;font-weight:700;color:${isVencido ? '#dc2626' : '#1a1a1a'};border-bottom:1px solid #eee;">${fmt(Number(comp.monto))}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const footerParts = [empresa.nombre, empresa.cuit ? `CUIT ${empresa.cuit}` : null, empresa.telefono ? `Tel: ${empresa.telefono}` : null, empresa.email, empresa.direccion].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; color: #333; }
</style>
</head>
<body>
<div style="max-width:750px;margin:0 auto;padding:32px 40px;background:white;min-height:297mm;">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
        ${logoTag}
        <div style="color:${NAVY};font-size:15px;font-weight:900;">${empresa.nombre}</div>
      </div>
      ${empresa.cuit     ? `<div style="color:#555;font-size:11px;">CUIT: ${empresa.cuit}</div>` : ''}
      ${empresa.telefono ? `<div style="color:#555;font-size:11px;">Tel: ${empresa.telefono}</div>` : ''}
      ${empresa.email    ? `<div style="color:#555;font-size:11px;">${empresa.email}</div>` : ''}
      ${empresa.direccion? `<div style="color:#555;font-size:11px;">${empresa.direccion}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="color:${NAVY};font-size:22px;font-weight:900;letter-spacing:1px;">ESTADO DE CUENTA</div>
      <div style="color:#666;font-size:11px;margin-top:4px;">Generado: ${hoy}</div>
    </div>
  </div>

  <div style="background:${NAVY};height:2px;margin-bottom:20px;"></div>

  <div style="background:#f8f9fa;border-radius:8px;padding:10px 14px;margin-bottom:20px;border-left:4px solid ${NAVY};">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Cliente</div>
    <div style="display:flex;align-items:baseline;gap:16px;">
      <span style="font-size:15px;font-weight:700;color:#1a1a1a;">${clienteNombre}</span>
      ${cl.documento_nro ? `<span style="font-size:11px;color:#555;">${cl.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'}: ${cl.documento_nro}</span>` : ''}
    </div>
    ${(cl.telefono || cl.email) ? `
      <div style="display:flex;gap:18px;font-size:11px;color:#555;margin-top:2px;">
        ${cl.telefono ? `<span>Tel: ${cl.telefono}</span>` : ''}
        ${cl.email    ? `<span>${cl.email}</span>` : ''}
      </div>
    ` : ''}
    ${(cl.direccion || cl.localidad) ? `<div style="font-size:11px;color:#555;margin-top:1px;">${[cl.direccion, cl.localidad].filter(Boolean).join(', ')}</div>` : ''}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
    <div style="background:#f8f9fa;border-radius:8px;padding:12px 14px;border:1px solid #e5e7eb;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Total Facturado</div>
      <div style="font-size:18px;font-weight:900;color:#1a1a1a;font-family:monospace;">${fmt(presupuestado)}</div>
    </div>
    <div style="background:#f0fdf4;border-radius:8px;padding:12px 14px;border:1px solid #bbf7d0;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Total Cobrado</div>
      <div style="font-size:18px;font-weight:900;color:#059669;font-family:monospace;">${fmt(cobrado)}</div>
      <div style="font-size:10px;color:#059669;margin-top:2px;">${pct}% del total</div>
    </div>
    <div style="background:${saldado ? '#f0fdf4' : '#fffbeb'};border-radius:8px;padding:12px 14px;border:1px solid ${saldado ? '#bbf7d0' : '#fde68a'};">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Saldo Pendiente</div>
      <div style="font-size:18px;font-weight:900;color:${saldoColor};font-family:monospace;">${fmt(Math.max(0, saldo))}</div>
      <div style="font-size:10px;color:${saldoColor};margin-top:2px;">${saldado ? 'Sin deuda' : 'Pendiente de cobro'}</div>
    </div>
  </div>

  ${movHTML}
  ${compHTML}

  <div style="border-top:2px solid ${RED};margin-top:28px;padding-top:12px;text-align:center;font-size:10px;color:#999;">
    ${footerParts}
  </div>

</div>
</body>
</html>`;
}

export async function generarPDFEstadoCuenta(data: EstadoCuentaPDF, empresa: EmpresaPDF): Promise<Buffer> {
  return renderPDF(buildEstadoCuentaHTML(data, empresa));
}

// ─── Recibo PDF ───────────────────────────────────────────────────────────────

export async function generarPDFRecibo(recibo: ReciboPDF, empresa: EmpresaPDF): Promise<Buffer> {
  return renderPDF(buildHTML(recibo, empresa));
}

// ─── Compras: Pedido de cotización (PC) y Orden de compra (OC) ───────────────

export interface CompraItemPDF {
  descripcion: string;
  /** Texto corto de la ficha técnica (ver resumenEspecificaciones en lib/compras.ts). */
  especificaciones: string | null;
  cantidad: number;
  unidad: string;
  /** Cliente / obra de origen (OC consolidada). */
  referencia?: string | null;
  proveedor_sku?: string | null;
  // Solo OC:
  precio_unitario_neto?: number | null;
  descuento_pct?: number | null;
  iva_pct?: number | null;
}

export interface CompraPDF {
  tipo: 'cotizacion' | 'orden';
  numero: string;
  fecha: string | Date;
  proveedor: { nombre: string; contacto: string | null; telefono: string | null; email: string | null; direccion?: string | null };
  items: CompraItemPDF[];
  /** PC: fecha límite para responder. OC: fecha prometida de entrega. */
  fecha_clave: string | Date | null;
  forma_pago?: string | null;
  observaciones?: string | null;
  /** SC / PC / operación de referencia, para el pie ("Ref.: SC-202609-0001"). */
  referencias?: string[];
  totales?: { subtotal_neto: number; descuento_monto: number; iva_monto: number; flete: number; total: number } | null;
}

const fmtCant = (n: number, unidad: string) => {
  const v = Number(n);
  const s = Number.isInteger(v) ? String(v) : v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidad && unidad !== 'u' ? `${s} ${unidad}` : s;
};

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildCompraHTML(d: CompraPDF, empresa: EmpresaPDF): string {
  const esOrden = d.tipo === 'orden';
  const titulo  = esOrden ? 'Orden de compra' : 'Pedido de cotizaci&oacute;n';
  const logo    = logoDataURI('logo2.png') ?? logoDataURI('logochico.png');
  const logoTag = logo ? `<img src="${logo}" alt="Logo" style="height:64px;display:block;">` : '';

  const contactParts = [
    empresa.cuit ? `CUIT: ${esc(empresa.cuit)}` : null,
    empresa.telefono ? `Tel: ${esc(empresa.telefono)}` : null,
    empresa.email ? esc(empresa.email) : null,
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');

  const th = (t: string, right = false) =>
    `<th style="text-align:${right ? 'right' : 'left'};padding:6px 8px;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${NAVY};">${t}</th>`;
  const td = (t: string, right = false, extra = '') =>
    `<td style="text-align:${right ? 'right' : 'left'};padding:7px 8px;font-size:11.5px;color:#222;border-bottom:1px solid #e5e7eb;vertical-align:top;${extra}">${t}</td>`;

  const filas = d.items.map((it, i) => {
    const pu    = Number(it.precio_unitario_neto ?? 0);
    const cant  = Number(it.cantidad);
    const dPct  = Number(it.descuento_pct ?? 0);
    const iPct  = Number(it.iva_pct ?? 0);
    const neto  = cant * pu * (1 - dPct / 100);
    const desc  = `<div style="font-weight:600;">${esc(it.descripcion)}</div>`
      + (it.especificaciones ? `<div style="font-size:10.5px;color:#555;margin-top:2px;">${esc(it.especificaciones)}</div>` : '')
      + (it.referencia ? `<div style="font-size:10px;color:#6b7280;margin-top:2px;">Ref.: ${esc(it.referencia)}</div>` : '')
      + (it.proveedor_sku ? `<div style="font-size:10px;color:#6b7280;margin-top:1px;">C&oacute;d. proveedor: ${esc(it.proveedor_sku)}</div>` : '');
    return `<tr>
      ${td(String(i + 1), false, 'color:#888;width:22px;')}
      ${td(desc)}
      ${td(fmtCant(cant, it.unidad), true, 'white-space:nowrap;font-weight:600;')}
      ${esOrden ? td(fmt(pu), true, 'white-space:nowrap;font-family:monospace;') : ''}
      ${esOrden ? td(dPct ? `${dPct}%` : '&mdash;', true) : ''}
      ${esOrden ? td(`${iPct}%`, true) : ''}
      ${esOrden ? td(fmt(neto), true, 'white-space:nowrap;font-family:monospace;font-weight:600;') : ''}
    </tr>`;
  }).join('');

  const t = d.totales;
  const totalesHTML = esOrden && t ? `
    <table style="margin-left:auto;margin-top:10px;border-collapse:collapse;min-width:260px;">
      <tr><td style="padding:3px 10px;font-size:11px;color:#555;">Subtotal neto</td><td style="padding:3px 0;font-size:11.5px;text-align:right;font-family:monospace;">${fmt(t.subtotal_neto)}</td></tr>
      ${t.descuento_monto > 0 ? `<tr><td style="padding:3px 10px;font-size:11px;color:#555;">Descuento</td><td style="padding:3px 0;font-size:11.5px;text-align:right;font-family:monospace;color:#b45309;">&minus; ${fmt(t.descuento_monto)}</td></tr>` : ''}
      <tr><td style="padding:3px 10px;font-size:11px;color:#555;">IVA</td><td style="padding:3px 0;font-size:11.5px;text-align:right;font-family:monospace;">${fmt(t.iva_monto)}</td></tr>
      ${t.flete > 0 ? `<tr><td style="padding:3px 10px;font-size:11px;color:#555;">Flete</td><td style="padding:3px 0;font-size:11.5px;text-align:right;font-family:monospace;">${fmt(t.flete)}</td></tr>` : ''}
      <tr><td style="padding:6px 10px 3px;font-size:12px;font-weight:800;color:${NAVY};border-top:2px solid ${NAVY};">TOTAL</td><td style="padding:6px 0 3px;font-size:14px;text-align:right;font-family:monospace;font-weight:900;color:${NAVY};border-top:2px solid ${NAVY};">${fmt(t.total)}</td></tr>
    </table>` : '';

  const fechaClaveLabel = esOrden ? 'Entrega prometida' : 'Responder antes del';
  const condiciones = [
    d.fecha_clave ? `<div><span style="color:#888;">${fechaClaveLabel}:</span> <strong>${fmtFecha(d.fecha_clave)}</strong></div>` : '',
    d.forma_pago  ? `<div><span style="color:#888;">Forma de pago:</span> <strong>${esc(d.forma_pago)}</strong></div>` : '',
  ].filter(Boolean).join('');

  const pedidoTexto = esOrden
    ? 'Por favor confirmar recepci&oacute;n de esta orden, precio, caracter&iacute;sticas y plazo de entrega.'
    : 'Solicitamos cotizar los &iacute;tems detallados indicando precio unitario neto, IVA, plazo de entrega, disponibilidad, forma de pago y validez de la oferta.';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Helvetica Neue', sans-serif; background: white; color: #333; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
<div style="max-width:750px;margin:0 auto;padding:14px 20px;background:white;min-height:273mm;display:flex;flex-direction:column;">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:12px;">
    <div style="flex:1;">
      <div style="display:flex;justify-content:center;margin-bottom:10px;">${logoTag}</div>
      <div style="height:1px;background:#e5e7eb;margin-bottom:8px;"></div>
      <div style="font-size:10.5px;color:#555;">${contactParts}</div>
      ${empresa.direccion ? `<div style="font-size:10.5px;color:#555;margin-top:2px;">${esc(empresa.direccion)}</div>` : ''}
    </div>
    <div style="width:1px;background:#d1d5db;align-self:stretch;margin:4px 0;"></div>
    <div style="text-align:right;min-width:210px;">
      <div style="color:${RED};font-size:${esOrden ? 30 : 24}px;font-weight:900;letter-spacing:1px;line-height:1.05;text-transform:uppercase;font-family:Georgia,serif;">${titulo}</div>
      <div style="color:${NAVY};font-weight:800;font-size:16px;margin-top:8px;">${esc(d.numero)}</div>
      <div style="font-size:11px;color:#555;margin-top:10px;"><strong style="color:${NAVY};">Fecha:</strong> ${fmtFecha(d.fecha)}</div>
      ${(d.referencias ?? []).length ? `<div style="font-size:10.5px;color:#555;margin-top:4px;">Ref.: ${d.referencias!.map(esc).join(' &middot; ')}</div>` : ''}
    </div>
  </div>

  <div style="height:4px;background:${NAVY};"></div>
  <div style="height:1px;background:#3a5fad;margin-bottom:14px;"></div>

  <div style="background:#f8f9fa;border-radius:8px;padding:8px 12px;margin-bottom:14px;border-left:4px solid ${NAVY};">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Proveedor</div>
    <div style="font-size:15px;font-weight:700;color:#1a1a1a;">${esc(d.proveedor.nombre)}</div>
    <div style="display:flex;gap:18px;font-size:11px;color:#555;margin-top:2px;flex-wrap:wrap;">
      ${d.proveedor.contacto ? `<span>At.: ${esc(d.proveedor.contacto)}</span>` : ''}
      ${d.proveedor.telefono ? `<span>Tel: ${esc(d.proveedor.telefono)}</span>` : ''}
      ${d.proveedor.email    ? `<span>${esc(d.proveedor.email)}</span>` : ''}
    </div>
  </div>

  <p style="font-size:11.5px;color:#444;margin-bottom:10px;">${pedidoTexto}</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
    <thead><tr>
      ${th('#')}${th('Detalle')}${th('Cant.', true)}
      ${esOrden ? th('P. unit. neto', true) + th('Desc.', true) + th('IVA', true) + th('Neto', true) : ''}
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>

  ${totalesHTML}

  ${condiciones ? `<div style="margin-top:14px;display:flex;gap:30px;flex-wrap:wrap;font-size:11.5px;color:#333;">${condiciones}</div>` : ''}

  ${d.observaciones ? `
    <div style="border:1px solid #ddd;border-radius:6px;padding:8px 12px;margin-top:14px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px;">Observaciones</div>
      <div style="font-size:11.5px;color:#444;white-space:pre-wrap;">${esc(d.observaciones)}</div>
    </div>` : ''}

  <div style="margin-top:auto;background:${NAVY};padding:10px 24px;display:flex;justify-content:center;flex-wrap:wrap;gap:0 28px;font-size:10px;color:#bfdbfe;">
    ${empresa.telefono  ? `<span>&#128222; ${esc(empresa.telefono)}</span>` : ''}
    ${empresa.email     ? `<span>&#9993; ${esc(empresa.email)}</span>` : ''}
    ${empresa.direccion ? `<span>&#128205; ${esc(empresa.direccion)}</span>` : ''}
  </div>
</div>
</body>
</html>`;
}

export async function generarPDFCompra(data: CompraPDF, empresa: EmpresaPDF): Promise<Buffer> {
  return renderPDF(buildCompraHTML(data, empresa));
}
