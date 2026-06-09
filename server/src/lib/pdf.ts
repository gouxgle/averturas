import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const NAVY = '#031d49';
const RED  = '#e31e24';

const fmt = (n: number) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtFecha = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
};

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
  numero: string; fecha: string; estado: string;
  forma_pago: string; referencia_pago: string | null;
  concepto: string | null; notas: string | null; monto_total: number;
  cliente: ClientePDF;
  operacion: { id?: string; numero: string; precio_total: number } | null;
  remito: { id?: string; numero: string } | null;
  items: ItemPDF[];
  created_by_nombre: string | null;
  cobrado_operacion: number;
  compromiso: CompromisoPDF | null;
}

function buildHTML(recibo: ReciboPDF, empresa: EmpresaPDF): string {
  const cl = recibo.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';

  // Logo embebido en base64
  let logoTag = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logochico.png');
    const logoData = fs.readFileSync(logoPath);
    const b64 = logoData.toString('base64');
    logoTag = `<img src="data:image/png;base64,${b64}" alt="Logo" style="height:34px;margin-right:10px;">`;
  } catch { /* sin logo */ }

  const tieneItems = recibo.items && recibo.items.length > 0;

  const itemsHTML = tieneItems ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f0f0f0;">
          <th style="text-align:left;padding:7px 10px;font-size:11px;font-weight:600;color:#555;">Descripcion</th>
          <th style="text-align:right;padding:7px 10px;font-size:11px;font-weight:600;color:#555;">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${recibo.items.map((item, i) => `
          <tr style="background:${i % 2 === 0 ? 'white' : '#f8f9fa'};">
            <td style="padding:7px 10px;font-size:13px;color:#333;border-bottom:1px solid #eee;">${item.descripcion}</td>
            <td style="padding:7px 10px;font-size:13px;text-align:right;font-family:monospace;border-bottom:1px solid #eee;">${fmt(Number(item.monto))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  let operacionHTML = '';
  if (recibo.operacion) {
    const saldo = Math.max(0, Number(recibo.operacion.precio_total) - Number(recibo.cobrado_operacion ?? 0));
    operacionHTML = `
      <div style="padding-top:10px;border-top:1px solid #eee;margin-bottom:20px;">
        <div style="display:flex;gap:40px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Total de la operacion</div>
            <div style="font-size:13px;font-weight:600;color:#333;">${fmt(Number(recibo.operacion.precio_total))}</div>
          </div>
          ${saldo >= 0.01 ? `
            <div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px;">Saldo pendiente</div>
              <div style="font-size:13px;font-weight:700;color:${RED};">
                ${fmt(saldo)}
                ${recibo.compromiso?.fecha_vencimiento ? `
                  <span style="font-weight:400;font-size:11px;color:#555;margin-left:8px;">
                    a cancelar el ${new Date(String(recibo.compromiso.fecha_vencimiento).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const footerParts = [
    empresa.nombre,
    empresa.cuit ? `CUIT ${empresa.cuit}` : null,
    empresa.telefono ? `Tel: ${empresa.telefono}` : null,
    empresa.email,
    empresa.direccion,
  ].filter(Boolean).join(' · ');

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

  <!-- Header -->
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
      <div style="color:${RED};font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Recibo</div>
      <div style="color:${NAVY};font-size:16px;font-weight:700;margin-top:4px;">${recibo.numero}</div>
      <div style="color:#666;font-size:11px;margin-top:4px;">Fecha: ${fmtFecha(recibo.fecha)}</div>
      ${recibo.operacion ? `<div style="font-size:11px;color:#555;margin-top:4px;">Ref. presupuesto: <strong>${recibo.operacion.numero}</strong></div>` : ''}
      ${recibo.remito    ? `<div style="font-size:11px;color:#555;">Ref. remito: <strong>${recibo.remito.numero}</strong></div>` : ''}
    </div>
  </div>

  <!-- Divisor -->
  <div style="background:${NAVY};height:2px;margin-bottom:20px;"></div>

  <!-- Cliente -->
  <div style="background:#f8f9fa;border-radius:8px;padding:10px 14px;margin-bottom:20px;border-left:4px solid ${NAVY};">
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
  <div style="border:2px solid ${NAVY};border-radius:10px;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
    <div>
      <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Importe total</div>
      <div style="color:${NAVY};font-size:28px;font-weight:900;font-family:monospace;margin-top:2px;">${fmt(Number(recibo.monto_total))}</div>
    </div>
    <div style="text-align:right;">
      <div style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Forma de pago</div>
      <div style="color:${NAVY};font-size:14px;font-weight:700;margin-top:2px;">${PAGO_LABEL[recibo.forma_pago] ?? recibo.forma_pago}</div>
      ${recibo.referencia_pago ? `<div style="color:#555;font-size:11px;margin-top:2px;">Ref: ${recibo.referencia_pago}</div>` : ''}
    </div>
  </div>

  <!-- Concepto -->
  ${recibo.concepto ? `
    <div style="margin-bottom:18px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">Concepto</div>
      <div style="font-size:13px;color:#333;">${recibo.concepto}</div>
    </div>
  ` : ''}

  <!-- Items -->
  ${itemsHTML}

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
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:56px;margin-top:52px;">
    <div style="text-align:center;">
      <div style="height:52px;"></div>
      <div style="border-top:1px solid #999;padding-top:10px;font-size:11px;color:#555;">
        Firma &mdash; ${empresa.nombre}${recibo.created_by_nombre ? ` (${recibo.created_by_nombre})` : ''}
      </div>
    </div>
    <div style="text-align:center;">
      <div style="height:52px;"></div>
      <div style="border-top:1px solid #999;padding-top:10px;font-size:11px;color:#555;">
        Firma y aclaracion &mdash; Cliente
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:2px solid ${RED};margin-top:28px;padding-top:12px;text-align:center;font-size:10px;color:#999;">
    ${footerParts}
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

const fmtDate = (iso: string) => {
  try { return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

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
            const isVencido = comp.estado === 'vencido' || (comp.estado === 'pendiente' && new Date(comp.fecha_vencimiento.slice(0, 10) + 'T12:00:00') < new Date());
            const detalle = [comp.descripcion, comp.banco, comp.numero_cheque ? 'Ch. ' + comp.numero_cheque : null, comp.operacion ? 'Op. ' + comp.operacion.numero : null].filter(Boolean).join(' · ') || '—';
            return `
              <tr style="background:${isVencido ? '#fff5f5' : i % 2 === 0 ? 'white' : '#f8f9fa'};">
                <td style="padding:6px 8px;font-size:11px;color:#555;border-bottom:1px solid #eee;">${COMP_TIPO[comp.tipo] ?? comp.tipo}</td>
                <td style="padding:6px 8px;font-size:11px;font-weight:600;color:${isVencido ? '#dc2626' : '#1a1a1a'};border-bottom:1px solid #eee;">${fmtDate(comp.fecha_vencimiento)}${isVencido ? ' &#9888;' : ''}</td>
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
  const html = buildEstadoCuentaHTML(data, empresa);
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

// ─── Recibo PDF ───────────────────────────────────────────────────────────────

export async function generarPDFRecibo(recibo: ReciboPDF, empresa: EmpresaPDF): Promise<Buffer> {
  const html = buildHTML(recibo, empresa);

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
