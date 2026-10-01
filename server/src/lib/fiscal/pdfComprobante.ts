import QRCode from 'qrcode';
import { db } from '../../db.js';
import { renderPDF, logoDataURI } from '../pdf.js';
import { leerConfig } from './config.js';
import { COND_IVA_DESC, CBTE_DESC } from './calculo.js';
import { iso } from './emision.js';

// PDF del comprobante electrónico. Se arma SIEMPRE desde lo guardado en la base (emisor y
// receptor copiados al emitir, ítems, IVA, CAE): no hay archivo que conservar, cualquier
// comprobante se reconstruye igual. Datos obligatorios (RG 1415 / RG 4291 / RG 4892):
// letra y código en recuadro, punto de venta y número, fecha, datos del emisor (razón
// social, domicilio, condición IVA, CUIT, IIBB, inicio de actividades), del receptor, CAE y
// vencimiento, y el QR. En la B, el bloque de Transparencia Fiscal (Ley 27.743).

const CODIGO: Record<number, string> = { 1: '01', 2: '02', 3: '03', 6: '06', 7: '07', 8: '08' };
const DOC: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: '' };
const CONCEPTO: Record<number, string> = { 1: 'Productos', 2: 'Servicios', 3: 'Productos y servicios' };

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const $ = (n: number | string) => `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number | string) => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 });
const fecha = (d: Date | string | null | undefined) => {
  const s = iso(d as Date | string | null);
  return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
};
const nro = (pv: number, n: number | string | null) =>
  `${String(pv).padStart(5, '0')}-${n ? String(n).padStart(8, '0') : '________'}`;
const cuitFmt = (c: string | null | undefined) => {
  const d = String(c ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d;
};

interface Emisor { cuit?: string | null; razon_social?: string | null; domicilio_fiscal?: string | null; iibb?: string | null; inicio_actividades?: string | null; leyenda_pie?: string | null }

export async function datosComprobantePDF(id: string) {
  const { rows: [c] } = await db.query(
    `SELECT c.*, a.cbte_tipo AS a_tipo, a.punto_venta AS a_pv, a.numero AS a_numero, a.fecha AS a_fecha,
            r.numero AS recibo_numero, o.numero AS operacion_numero, cl.telefono AS cliente_telefono, cl.email AS cliente_email
       FROM comprobantes c
       LEFT JOIN comprobantes a ON a.id = c.comprobante_asociado_id
       LEFT JOIN recibos r ON r.id = c.recibo_id
       LEFT JOIN operaciones o ON o.id = c.operacion_id
       LEFT JOIN clientes cl ON cl.id = c.cliente_id
      WHERE c.id = $1`, [id]).catch(() => ({ rows: [] }));
  if (!c) return null;
  const [{ rows: items }, { rows: iva }, { rows: [emp] }] = await Promise.all([
    db.query(`SELECT * FROM comprobante_items WHERE comprobante_id = $1 ORDER BY orden`, [id]),
    db.query(`SELECT * FROM comprobante_iva WHERE comprobante_id = $1 ORDER BY alicuota_id`, [id]),
    db.query(`SELECT nombre, telefono, email FROM empresa ORDER BY updated_at DESC LIMIT 1`),
  ]);
  // Emisor: el copiado al emitir; en un borrador todavía no hay copia, se usa la configuración actual.
  let emisor: Emisor = c.emisor ?? {};
  if (!c.emisor) {
    const cfg = await leerConfig();
    emisor = { cuit: cfg.cuit, razon_social: cfg.razon_social, domicilio_fiscal: cfg.domicilio_fiscal, iibb: cfg.iibb,
      inicio_actividades: iso(cfg.inicio_actividades), leyenda_pie: cfg.leyenda_pie };
  }
  return { c, items, iva, emisor, empresa: emp ?? null };
}

type Datos = NonNullable<Awaited<ReturnType<typeof datosComprobantePDF>>>;

function pagina(d: Datos, copia: string, qrDataUrl: string | null): string {
  const { c, items, iva, emisor, empresa } = d;
  const esA = c.clase === 'A';
  const autorizado = c.estado === 'autorizado';
  const marca = !autorizado ? 'BORRADOR — SIN VALIDEZ FISCAL'
    : c.ambiente === 'homologacion' ? 'COMPROBANTE DE PRUEBA — SIN VALIDEZ FISCAL' : null;
  const logo = logoDataURI('logo2.png') ?? logoDataURI('logochico.png');
  const precioMostrado = (it: { precio_unitario: string; alicuota: string; exento: boolean }) =>
    esA && !it.exento ? Number(it.precio_unitario) / (1 + Number(it.alicuota) / 100) : Number(it.precio_unitario);
  const subtotalMostrado = (it: { neto: string; total: string; exento: boolean }) =>
    esA && !it.exento ? Number(it.neto) : Number(it.total);

  const filas = items.map(it => `
    <tr>
      <td>${esc(it.descripcion)}${it.es_servicio ? ' <span class="tag">servicio</span>' : ''}</td>
      <td class="n">${num(it.cantidad)}</td>
      <td class="n">${$(precioMostrado(it))}</td>
      <td class="n">${Number(it.bonificacion) > 0 ? $(esA && !it.exento ? Number(it.bonificacion) / (1 + Number(it.alicuota) / 100) : it.bonificacion) : ''}</td>
      ${esA ? `<td class="n">${it.exento ? 'Exento' : `${num(it.alicuota)}%`}</td>` : ''}
      <td class="n">${$(subtotalMostrado(it))}</td>
    </tr>`).join('');

  const totales = esA
    ? `<tr><td>Importe neto gravado</td><td class="n">${$(c.imp_neto)}</td></tr>
       ${iva.map(a => `<tr><td>IVA ${num(a.alicuota)}%</td><td class="n">${$(a.importe)}</td></tr>`).join('')}
       ${Number(c.imp_op_ex) > 0 ? `<tr><td>Importe exento</td><td class="n">${$(c.imp_op_ex)}</td></tr>` : ''}`
    : `<tr><td>Subtotal</td><td class="n">${$(c.imp_total)}</td></tr>`;

  const asociado = c.comprobante_asociado_id && c.a_tipo
    ? `<p class="asoc">Comprobante asociado: <b>${esc(CBTE_DESC[c.a_tipo])} ${nro(c.a_pv, c.a_numero)}</b> del ${fecha(c.a_fecha)}</p>` : '';
  const referencia = c.recibo_numero ? `Recibo ${esc(c.recibo_numero)}`
    : c.operacion_numero ? `Proforma ${esc(String(c.operacion_numero).replace(/^OP-/, 'PRO-'))}` : '';

  return `
  <section class="pagina">
    ${marca ? `<div class="marca">${marca}</div>` : ''}
    <div class="copia">${copia}</div>
    <header>
      <div class="emisor">
        ${logo ? `<img src="${logo}" class="logo" alt="">` : ''}
        <p class="rs">${esc(emisor.razon_social ?? empresa?.nombre ?? '')}</p>
        <p>${esc(emisor.domicilio_fiscal ?? '')}</p>
        <p>IVA Responsable Inscripto</p>
        ${empresa?.telefono || empresa?.email ? `<p class="contacto">${esc([empresa?.telefono, empresa?.email].filter(Boolean).join(' · '))}</p>` : ''}
      </div>
      <div class="letra"><span>${c.clase}</span><small>COD. ${CODIGO[c.cbte_tipo] ?? ''}</small></div>
      <div class="datos">
        <p class="tipo">${esc(CBTE_DESC[c.cbte_tipo]).replace(/ [AB]$/, '').toUpperCase()}</p>
        <p class="nro">N° ${nro(c.punto_venta, c.numero)}</p>
        <p>Fecha de emisión: <b>${fecha(c.fecha)}</b></p>
        <p>CUIT: ${cuitFmt(emisor.cuit)}</p>
        <p>Ingresos Brutos: ${esc(emisor.iibb ?? '')}</p>
        <p>Inicio de actividades: ${fecha(emisor.inicio_actividades)}</p>
      </div>
    </header>
    ${c.concepto !== 1 ? `<div class="periodo">Período facturado desde <b>${fecha(c.fch_serv_desde)}</b> hasta <b>${fecha(c.fch_serv_hasta)}</b> · Vencimiento del pago: <b>${fecha(c.fch_vto_pago)}</b></div>` : ''}
    <div class="receptor">
      <div><span>${c.receptor_doc_tipo === 99 ? 'Cliente' : 'Apellido y nombre / Razón social'}:</span> <b>${esc(c.receptor_nombre)}</b></div>
      <div><span>${DOC[c.receptor_doc_tipo] || 'Documento'}:</span> ${c.receptor_doc_tipo === 99 ? 'Sin identificar' : c.receptor_doc_tipo === 80 ? cuitFmt(c.receptor_doc_nro) : esc(c.receptor_doc_nro)}</div>
      <div><span>Condición frente al IVA:</span> ${esc(COND_IVA_DESC[c.receptor_condicion_iva_id] ?? '')}</div>
      <div><span>Domicilio:</span> ${esc(c.receptor_domicilio ?? '')}</div>
      <div><span>Concepto:</span> ${CONCEPTO[c.concepto]}${referencia ? ` · <span>Referencia:</span> ${referencia}` : ''}</div>
    </div>
    ${asociado}
    <table class="items">
      <thead><tr><th>Descripción</th><th class="n">Cant.</th><th class="n">${esA ? 'Precio unit. (sin IVA)' : 'Precio unit.'}</th><th class="n">Bonif.</th>${esA ? '<th class="n">IVA</th>' : ''}<th class="n">Subtotal</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="pie-tabla">
      <div class="transparencia">${!esA ? `
        <p class="tt">Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</p>
        <p>IVA contenido: <b>${$(c.imp_iva)}</b></p>
        <p>Otros impuestos nacionales indirectos: <b>${$(0)}</b></p>` : ''}
      </div>
      <table class="totales">${totales}<tr class="total"><td>TOTAL</td><td class="n">${$(c.imp_total)}</td></tr></table>
    </div>
    <footer>
      ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr" alt="QR">` : '<div class="qr vacio"></div>'}
      <div class="arca">
        ${autorizado
          ? `<p class="ok">Comprobante autorizado por ARCA</p>
             <p>CAE N°: <b>${esc(c.cae)}</b></p><p>Vencimiento del CAE: <b>${fecha(c.cae_vto)}</b></p>`
          : `<p class="ok">Comprobante no autorizado</p><p>Todavía no fue emitido con ARCA.</p>`}
        ${emisor.leyenda_pie ? `<p class="leyenda">${esc(emisor.leyenda_pie)}</p>` : ''}
      </div>
    </footer>
  </section>`;
}

const CSS = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 10.5px; color: #111; margin: 0; }
  .pagina { position: relative; min-height: 275mm; padding: 2mm; page-break-after: always; display: flex; flex-direction: column; }
  .pagina:last-child { page-break-after: auto; }
  .marca { position: absolute; top: 45%; left: 0; right: 0; text-align: center; transform: rotate(-24deg);
    font-size: 30px; font-weight: 800; color: rgba(220,38,38,0.16); letter-spacing: 2px; }
  .copia { text-align: center; font-weight: 800; letter-spacing: 3px; border: 1.5px solid #111; padding: 3px; margin-bottom: 4px; }
  header { display: grid; grid-template-columns: 1fr 74px 1fr; border: 1.5px solid #111; }
  .emisor, .datos { padding: 8px 10px; }
  .emisor p, .datos p { margin: 2px 0; }
  .logo { height: 46px; margin-bottom: 4px; }
  .rs { font-size: 13px; font-weight: 800; }
  .contacto { color: #444; }
  .letra { border-left: 1.5px solid #111; border-right: 1.5px solid #111; display: flex; flex-direction: column;
    align-items: center; justify-content: flex-start; padding-top: 4px; }
  .letra span { font-size: 40px; font-weight: 900; line-height: 1; border: 1.5px solid #111; width: 52px; text-align: center; padding: 2px 0; background: #fff; }
  .letra small { font-size: 9px; font-weight: 700; margin-top: 3px; }
  .tipo { font-size: 17px; font-weight: 900; letter-spacing: 1px; }
  .nro { font-size: 13px; font-weight: 800; }
  .periodo, .receptor, .asoc { border: 1.5px solid #111; border-top: none; padding: 6px 10px; }
  .receptor { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; }
  .receptor span, .periodo span { color: #444; }
  .asoc { margin: 0; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { background: #ececec; border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 9.5px; }
  table.items td { border-bottom: 1px solid #ddd; padding: 4px 6px; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .tag { font-size: 8.5px; color: #555; border: 1px solid #bbb; border-radius: 3px; padding: 0 3px; }
  .pie-tabla { display: flex; justify-content: space-between; gap: 16px; margin-top: 8px; }
  .transparencia { font-size: 9.5px; }
  .transparencia .tt { font-weight: 800; margin-bottom: 2px; }
  .transparencia p { margin: 1px 0; }
  table.totales { border-collapse: collapse; min-width: 240px; }
  table.totales td { padding: 3px 6px; }
  table.totales .total td { border-top: 1.5px solid #111; font-size: 14px; font-weight: 900; }
  footer { margin-top: auto; border-top: 1.5px solid #111; padding-top: 8px; display: flex; gap: 14px; align-items: center; }
  .qr { width: 96px; height: 96px; }
  .qr.vacio { border: 1px dashed #bbb; }
  .arca p { margin: 2px 0; }
  .arca .ok { font-weight: 800; font-size: 12px; }
  .leyenda { color: #444; margin-top: 6px !important; }
`;

export async function htmlComprobante(d: Datos, copias: string[] = ['ORIGINAL']): Promise<string> {
  const qr = d.c.estado === 'autorizado' && d.c.qr_url
    ? await QRCode.toDataURL(d.c.qr_url, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
    : null;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head>` +
    `<body>${copias.map(cp => pagina(d, cp, qr)).join('')}</body></html>`;
}

/** PDF del comprobante. `copias` = 1 (ORIGINAL), 2 (+DUPLICADO) o 3 (+TRIPLICADO). */
export async function generarPDFComprobante(id: string, copias = 1): Promise<{ pdf: Buffer; nombre: string; datos: Datos } | null> {
  const d = await datosComprobantePDF(id);
  if (!d) return null;
  const lista = ['ORIGINAL', 'DUPLICADO', 'TRIPLICADO'].slice(0, Math.min(Math.max(copias, 1), 3));
  const pdf = await renderPDF(await htmlComprobante(d, lista));
  const tipo = (CBTE_DESC[d.c.cbte_tipo] ?? 'Comprobante').replace(/\s+/g, '-');
  return { pdf, nombre: `${tipo}-${nro(d.c.punto_venta, d.c.numero)}.pdf`, datos: d };
}
