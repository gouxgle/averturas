import PDFDocument from 'pdfkit';

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
  tarjeta_debito:  'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  mercadopago:     'MercadoPago',
  otro:            'Otro',
};

interface EmpresaPDF {
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
}

interface ItemPDF {
  descripcion: string; cantidad: number; monto: number; producto_nombre: string | null;
}

interface ReciboPDF {
  numero: string; fecha: string; estado: string;
  forma_pago: string; referencia_pago: string | null;
  concepto: string | null; notas: string | null; monto_total: number;
  cliente: ClientePDF;
  operacion: { numero: string; precio_total: number } | null;
  items: ItemPDF[];
  created_by_nombre: string | null;
  cobrado_operacion: number;
}

export function generarPDFRecibo(recibo: ReciboPDF, empresa: EmpresaPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // ancho útil (margins 50 c/lado)

    // ── Encabezado ───────────────────────────────────────────
    doc.rect(50, 40, W, 70).fill(NAVY);

    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
       .text(empresa.nombre, 60, 55, { width: W * 0.6 });

    if (empresa.cuit) {
      doc.fontSize(9).font('Helvetica')
         .text(`CUIT: ${empresa.cuit}`, 60, 78, { width: W * 0.6 });
    }
    if (empresa.telefono) {
      doc.text(`Tel: ${empresa.telefono}`, 60, 90, { width: W * 0.6 });
    }

    // Recibo title (derecha)
    doc.fillColor(RED).fontSize(20).font('Helvetica-Bold')
       .text('RECIBO', 50 + W * 0.62, 50, { width: W * 0.38, align: 'right' });
    doc.fillColor('white').fontSize(11).font('Helvetica')
       .text(`N° ${recibo.numero}`, 50 + W * 0.62, 75, { width: W * 0.38, align: 'right' });
    doc.text(fmtFecha(recibo.fecha), 50 + W * 0.62, 90, { width: W * 0.38, align: 'right' });

    let y = 130;

    // ── Cliente ──────────────────────────────────────────────
    const cl = recibo.cliente;
    const clienteNombre = cl.tipo_persona === 'juridica'
      ? (cl.razon_social ?? '—')
      : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';

    doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('CLIENTE', 50, y);
    doc.moveTo(50, y + 12).lineTo(50 + W, y + 12).strokeColor(NAVY).lineWidth(0.5).stroke();
    y += 18;

    doc.fillColor('#333').font('Helvetica-Bold').fontSize(10).text(clienteNombre, 50, y);
    y += 14;
    doc.font('Helvetica').fontSize(9);
    if (cl.documento_nro) { doc.fillColor('#555').text(`DNI/CUIT: ${cl.documento_nro}`, 50, y); y += 12; }
    if (cl.direccion)     { doc.text(cl.direccion + (cl.localidad ? `, ${cl.localidad}` : ''), 50, y); y += 12; }

    y += 10;

    // ── Detalle del pago ─────────────────────────────────────
    doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('DETALLE DEL PAGO', 50, y);
    doc.moveTo(50, y + 12).lineTo(50 + W, y + 12).strokeColor(NAVY).lineWidth(0.5).stroke();
    y += 18;

    const infoRows: [string, string][] = [
      ['Forma de pago', PAGO_LABEL[recibo.forma_pago] ?? recibo.forma_pago],
    ];
    if (recibo.referencia_pago) infoRows.push(['Referencia', recibo.referencia_pago]);
    if (recibo.concepto) infoRows.push(['Concepto', recibo.concepto]);
    if (recibo.operacion) infoRows.push(['Presupuesto', recibo.operacion.numero]);

    doc.font('Helvetica').fontSize(9).fillColor('#333');
    for (const [label, value] of infoRows) {
      doc.font('Helvetica-Bold').text(`${label}:`, 50, y, { continued: true, width: 130 });
      doc.font('Helvetica').text(` ${value}`, { width: W - 130 });
      y += 14;
    }

    y += 8;

    // ── Items ────────────────────────────────────────────────
    if (recibo.items.length > 0) {
      doc.fillColor(NAVY).fontSize(9).font('Helvetica-Bold').text('ITEMS', 50, y);
      doc.moveTo(50, y + 12).lineTo(50 + W, y + 12).strokeColor(NAVY).lineWidth(0.5).stroke();
      y += 18;

      // Header
      doc.rect(50, y, W, 16).fill('#f0f4f8');
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8)
         .text('Descripción', 56, y + 4, { width: W * 0.55 });
      doc.text('Cant.', 56 + W * 0.55, y + 4, { width: W * 0.15, align: 'right' });
      doc.text('Monto', 56 + W * 0.7, y + 4, { width: W * 0.3 - 6, align: 'right' });
      y += 16;

      for (const item of recibo.items) {
        const desc = item.producto_nombre ?? item.descripcion;
        doc.fillColor('#333').font('Helvetica').fontSize(9)
           .text(desc, 56, y, { width: W * 0.55 });
        doc.text(String(item.cantidad), 56 + W * 0.55, y, { width: W * 0.15, align: 'right' });
        doc.text(fmt(item.monto), 56 + W * 0.7, y, { width: W * 0.3 - 6, align: 'right' });
        y += 14;
        doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
      }
      y += 6;
    }

    // ── Total ────────────────────────────────────────────────
    y += 4;
    doc.rect(50 + W * 0.5, y, W * 0.5, 28).fill(NAVY);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
       .text('TOTAL RECIBIDO', 56 + W * 0.5, y + 4, { width: W * 0.5 - 12, align: 'left' });
    doc.fontSize(13)
       .text(fmt(recibo.monto_total), 56 + W * 0.5, y + 4, { width: W * 0.5 - 12, align: 'right' });
    y += 36;

    // Saldo pendiente si corresponde
    if (recibo.operacion && recibo.cobrado_operacion < recibo.operacion.precio_total - 0.01) {
      const saldo = recibo.operacion.precio_total - recibo.cobrado_operacion;
      doc.fillColor('#b45309').font('Helvetica').fontSize(8)
         .text(`Saldo pendiente de esta operación: ${fmt(saldo)}`, 50 + W * 0.5, y, { width: W * 0.5, align: 'right' });
      y += 14;
    }

    // ── Notas ────────────────────────────────────────────────
    if (recibo.notas) {
      y += 10;
      doc.fillColor('#6b7280').font('Helvetica').fontSize(8).text(`Notas: ${recibo.notas}`, 50, y, { width: W });
      y += 14;
    }

    // ── Pie ──────────────────────────────────────────────────
    const pageBottom = doc.page.height - 60;
    doc.moveTo(50, pageBottom).lineTo(50 + W, pageBottom).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.fillColor('#9ca3af').font('Helvetica').fontSize(7)
       .text(empresa.nombre + (empresa.email ? ` | ${empresa.email}` : '') + (empresa.telefono ? ` | ${empresa.telefono}` : ''),
         50, pageBottom + 6, { width: W, align: 'center' });

    doc.end();
  });
}
