import { db } from '../../db.js';
import { hoyAR } from '../fechas.js';
import { cuitValido, normalizarCuit } from './cuit.js';
import { condicionIvaId } from './condicionIva.js';
import { DOC_TIPO, aCent, type ItemEntrada, type Receptor } from './calculo.js';
import type { NuevoComprobante } from './emision.js';

// De dónde sale una factura: un recibo (cada cobro, incluidas las señas), un presupuesto
// aprobado o a mano. Acá se arma la propuesta y se controla que no se facture dos veces lo
// mismo: lo facturado cuenta facturas y notas de débito autorizadas (o en camino) menos las
// notas de crédito.

const ESTADOS_QUE_CUENTAN = `('autorizado', 'emitiendo', 'incierto', 'contingencia')`;
const SIGNO = `CASE WHEN tipo_doc = 'nota_credito' THEN -imp_total ELSE imp_total END`;
const ESTADOS_OPERACION_FACTURABLE = `('aprobado', 'en_produccion', 'listo', 'instalado', 'entregado')`;

const a2 = (n: number) => Math.round(n * 100) / 100;

interface ClienteFila {
  id: string; tipo_persona: string; nombre: string | null; apellido: string | null; razon_social: string | null;
  documento_nro: string | null; cuit: string | null; condicion_iva: string | null;
  domicilio_fiscal: string | null; direccion: string | null; localidad: string | null;
}

/** Receptor del comprobante a partir de la ficha del cliente. */
export function receptorDeCliente(c: ClienteFila): Receptor {
  const condicion = condicionIvaId(c.condicion_iva);
  const cuit = normalizarCuit(c.cuit);
  const dni = String(c.documento_nro ?? '').replace(/\D/g, '');
  const [docTipo, docNro] = cuitValido(cuit)
    ? [DOC_TIPO.CUIT, cuit]
    : /^\d{6,8}$/.test(dni) ? [DOC_TIPO.DNI, dni]
      : cuitValido(dni) ? [DOC_TIPO.CUIT, dni]
        : [DOC_TIPO.SIN_IDENTIFICAR, '0'];
  const nombre = c.tipo_persona === 'juridica'
    ? (c.razon_social || c.nombre || '')
    : [c.apellido, c.nombre].filter(Boolean).join(' ') || c.razon_social || '';
  return {
    doc_tipo: docTipo, doc_nro: docNro, nombre: nombre.trim(), condicion_iva_id: condicion,
    domicilio: c.domicilio_fiscal || [c.direccion, c.localidad].filter(Boolean).join(', ') || null,
  };
}

const COLS_CLIENTE = `id, tipo_persona, nombre, apellido, razon_social, documento_nro, cuit, condicion_iva,
  domicilio_fiscal, direccion, localidad`;

export async function receptorDeClienteId(id: string): Promise<{ receptor: Receptor; cliente_id: string } | null> {
  const { rows: [c] } = await db.query(`SELECT ${COLS_CLIENTE} FROM clientes WHERE id = $1`, [id]).catch(() => ({ rows: [] }));
  return c ? { receptor: receptorDeCliente(c), cliente_id: c.id } : null;
}

export async function facturadoDe(campo: 'recibo_id' | 'operacion_id' | 'remito_id', id: string): Promise<number> {
  const { rows: [r] } = await db.query(
    `SELECT COALESCE(SUM(${SIGNO}), 0) AS t FROM comprobantes WHERE ${campo} = $1 AND estado IN ${ESTADOS_QUE_CUENTAN}`, [id]);
  return a2(Number(r.t));
}

/** Total facturable de una operación: productos + instalación + envío − bonificaciones cobradas. */
async function totalOperacion(id: string): Promise<{ total: number; descuentos: number; envio: number; precio: number } | null> {
  const { rows: [o] } = await db.query(
    `SELECT o.precio_total, COALESCE(o.costo_envio, 0) AS costo_envio,
            (SELECT COALESCE(SUM(monto_descuento), 0) FROM recibos r WHERE r.operacion_id = o.id AND r.estado = 'emitido') AS descuentos
       FROM operaciones o WHERE o.id = $1`, [id]);
  if (!o) return null;
  const precio = Number(o.precio_total), envio = Number(o.costo_envio), descuentos = Number(o.descuentos);
  return { total: a2(precio + envio - descuentos), descuentos, envio, precio };
}

/**
 * Reparte una bonificación (importe final) entre las líneas de producto proporcionalmente a
 * su importe; no toca instalación ni envío (igual que en el recibo). En centavos, y la última
 * línea absorbe el redondeo, así la suma es exacta.
 */
export function repartirBonificacion(lineas: ItemEntrada[], descuento: number): void {
  if (!(descuento > 0)) return;
  const productos = lineas.filter(l => !l.es_servicio);
  const base = productos.reduce((a, l) => a + aCent(l.cantidad * l.precio_unitario), 0);
  if (!base) return;
  const totalC = aCent(descuento);
  let restante = totalC;
  productos.forEach((l, i) => {
    const linea = aCent(l.cantidad * l.precio_unitario);
    const parte = i === productos.length - 1 ? restante : Math.round(totalC * linea / base);
    l.bonificacion = parte / 100;
    restante -= parte;
  });
}

export interface Propuesta {
  comprobante: NuevoComprobante;
  referencia: string;            // "Recibo REC-202609-0012" / "Presupuesto PRO-00123"
  total_origen: number;
  facturado: number;
  saldo: number;
  avisos: string[];
}

export async function prepararDesdeRecibo(reciboId: string): Promise<Propuesta | null> {
  const { rows: [r] } = await db.query(
    `SELECT r.*, o.numero AS op_numero FROM recibos r LEFT JOIN operaciones o ON o.id = r.operacion_id WHERE r.id = $1`, [reciboId]);
  if (!r) return null;
  const { rows: [cli] } = await db.query(`SELECT ${COLS_CLIENTE} FROM clientes WHERE id = $1`, [r.cliente_id]);
  const { rows: items } = await db.query(`SELECT descripcion, cantidad, monto FROM recibo_items WHERE recibo_id = $1 ORDER BY orden`, [reciboId]);

  const total = Number(r.monto_total);
  const facturado = await facturadoDe('recibo_id', reciboId);
  const saldo = a2(total - facturado);
  const avisos: string[] = [];
  if (r.estado !== 'emitido') avisos.push(`El recibo está ${r.estado}`);
  if (facturado > 0) avisos.push(`Este recibo ya tiene $ ${facturado.toLocaleString('es-AR')} facturados`);

  const proforma = r.op_numero ? String(r.op_numero).replace(/^OP-/, 'PRO-') : null;
  const sumaItems = items.reduce((a, i) => a + Number(i.monto), 0);
  let lineas: ItemEntrada[];
  if (facturado === 0 && items.length && Math.abs(sumaItems - total) < 0.01) {
    lineas = items.map(i => ({
      descripcion: Number(i.cantidad) > 1 ? `${Number(i.cantidad)} × ${i.descripcion}` : String(i.descripcion),
      cantidad: 1, precio_unitario: Number(i.monto),
    }));
  } else {
    // El concepto del recibo es interno (menciona saldos y compromisos): no va a la factura.
    const concepto = proforma ? `Pago a cuenta de la proforma ${proforma}` : 'Pago a cuenta';
    lineas = [{ descripcion: concepto, cantidad: 1, precio_unitario: Math.max(saldo, 0) }];
  }
  return {
    comprobante: {
      tipo_doc: 'factura', receptor: cli ? receptorDeCliente(cli) : { doc_tipo: 99, doc_nro: '0', nombre: 'Consumidor Final', condicion_iva_id: 5 },
      items: lineas, cliente_id: r.cliente_id, origen: 'recibo', recibo_id: r.id, operacion_id: r.operacion_id ?? null,
      fecha: hoyAR(),
    },
    referencia: `Recibo ${r.numero}`, total_origen: total, facturado, saldo, avisos,
  };
}


/** Lo que ya se facturó de cada ítem del presupuesto (facturas menos notas de crédito). */
async function facturadoPorItem(operacionId: string): Promise<Map<string, number>> {
  const { rows } = await db.query(
    `SELECT i.operacion_item_id AS id,
            SUM(CASE WHEN c.tipo_doc = 'nota_credito' THEN -i.cantidad WHEN c.tipo_doc = 'factura' THEN i.cantidad ELSE 0 END) AS cant
       FROM comprobante_items i JOIN comprobantes c ON c.id = i.comprobante_id
      WHERE c.operacion_id = $1 AND i.operacion_item_id IS NOT NULL AND c.estado IN ${ESTADOS_QUE_CUENTAN}
      GROUP BY i.operacion_item_id`, [operacionId]);
  return new Map(rows.map(r => [r.id as string, Number(r.cant)]));
}

export async function prepararDesdeRemito(remitoId: string): Promise<Propuesta | null> {
  const { rows: [m] } = await db.query(`SELECT id, numero, cliente_id, operacion_id, estado FROM remitos WHERE id = $1`, [remitoId]);
  if (!m) return null;
  const { rows: cli } = await db.query(`SELECT ${COLS_CLIENTE} FROM clientes WHERE id = $1`, [m.cliente_id]);
  const { rows: items } = await db.query(
    `SELECT id, producto_id, descripcion, cantidad, precio_unitario FROM remito_items WHERE remito_id = $1 ORDER BY ctid`, [remitoId]);
  // El remito puede no tener precios: se toman del presupuesto del que sale (mismo producto).
  const { rows: delPresupuesto } = m.operacion_id
    ? await db.query(`SELECT id, producto_id, descripcion, precio_unitario, tipo_item FROM operacion_items WHERE operacion_id = $1`, [m.operacion_id])
    : { rows: [] as Record<string, unknown>[] };
  const avisos: string[] = [];
  const sinPrecio: string[] = [];
  const lineas: ItemEntrada[] = items.map(it => {
    let precio = Number(it.precio_unitario ?? 0);
    let opItem: Record<string, unknown> | undefined;
    if (m.operacion_id) {
      opItem = delPresupuesto.find(o => it.producto_id && o.producto_id === it.producto_id)
        ?? delPresupuesto.find(o => String(o.descripcion).trim().toLowerCase() === String(it.descripcion).trim().toLowerCase());
      if (!(precio > 0) && opItem) precio = Number(opItem.precio_unitario);
    }
    if (!(precio > 0)) sinPrecio.push(String(it.descripcion));
    return {
      descripcion: String(it.descripcion), cantidad: Number(it.cantidad), precio_unitario: precio,
      producto_id: (it.producto_id as string | null) ?? null, operacion_item_id: (opItem?.id as string | undefined) ?? null,
    };
  });
  if (sinPrecio.length) avisos.push(`Sin precio en el remito ni en el presupuesto: ${sinPrecio.join(', ')}. Cargalo a mano o quitá el ítem.`);
  if (!['emitido', 'entregado'].includes(m.estado)) avisos.push(`El remito está ${m.estado}: solo se factura un remito emitido o entregado`);

  const total = a2(lineas.reduce((a, l) => a + aCent(l.cantidad * l.precio_unitario), 0) / 100);
  const facturado = await facturadoDe('remito_id', remitoId);
  const saldo = a2(total - facturado);
  if (facturado > 0) avisos.push(`Este remito ya tiene $ ${facturado.toLocaleString('es-AR')} facturados`);
  if (m.operacion_id) {
    const factOp = await facturadoDe('operacion_id', m.operacion_id);
    const factRemito = facturado;
    if (factOp - factRemito > 0) {
      avisos.push(`Del presupuesto de este remito ya se facturaron $ ${a2(factOp - factRemito).toLocaleString('es-AR')} por otros comprobantes (señas o facturas): revisá que no se repita lo mismo.`);
    }
  }
  return {
    comprobante: {
      tipo_doc: 'factura', receptor: cli[0] ? receptorDeCliente(cli[0]) : { doc_tipo: 99, doc_nro: '0', nombre: 'Consumidor Final', condicion_iva_id: 5 },
      items: lineas, cliente_id: m.cliente_id, origen: 'remito', remito_id: m.id, operacion_id: m.operacion_id ?? null, fecha: hoyAR(),
    },
    referencia: `Remito ${m.numero}`, total_origen: total, facturado, saldo, avisos,
  };
}

export async function prepararDesdeOperacion(operacionId: string): Promise<Propuesta | null> {
  const { rows: [o] } = await db.query(`SELECT id, numero, cliente_id, estado FROM operaciones WHERE id = $1`, [operacionId]);
  if (!o) return null;
  const tot = (await totalOperacion(operacionId))!;
  const { rows: [cli] } = await db.query(`SELECT ${COLS_CLIENTE} FROM clientes WHERE id = $1`, [o.cliente_id]);
  const { rows: items } = await db.query(
    `SELECT id, descripcion, cantidad, precio_unitario, incluye_instalacion, precio_instalacion, tipo_item, producto_id
       FROM operacion_items WHERE operacion_id = $1 ORDER BY orden`, [operacionId]);

  // Lo ya facturado por ítem (en otra factura parcial) no se vuelve a proponer: se factura solo lo que queda.
  const yaFacturado = await facturadoPorItem(operacionId);
  const lineas: ItemEntrada[] = [];
  const yaFacturados: string[] = [];
  for (const it of items) {
    const esServicio = it.tipo_item === 'servicio';
    const hecho = yaFacturado.get(it.id) ?? 0;
    const cantidad = Number(it.cantidad) - hecho;
    if (hecho > 0 && cantidad <= 0) { yaFacturados.push(String(it.descripcion)); continue; }
    if (Number(it.precio_unitario) > 0) {
      lineas.push({
        descripcion: it.descripcion, cantidad, precio_unitario: Number(it.precio_unitario),
        es_servicio: esServicio, producto_id: it.producto_id, operacion_item_id: it.id,
      });
    }
    if (it.incluye_instalacion && Number(it.precio_instalacion) > 0) {
      lineas.push({
        descripcion: `Instalación — ${it.descripcion}`, cantidad,
        precio_unitario: Number(it.precio_instalacion), es_servicio: true, operacion_item_id: it.id,
      });
    }
  }
  if (!yaFacturado.size && tot.envio > 0) lineas.push({ descripcion: 'Envío', cantidad: 1, precio_unitario: tot.envio, es_servicio: true });

  // La bonificación se reparte entre los ítems en la primera factura; en una parcial no se repite.
  if (!yaFacturado.size) repartirBonificacion(lineas, tot.descuentos);

  const facturado = await facturadoDe('operacion_id', operacionId);
  const saldo = a2(tot.total - facturado);
  const avisos: string[] = [];
  if (!ESTADOS_OPERACION_FACTURABLE.includes(`'${o.estado}'`)) avisos.push(`El presupuesto todavía no está aprobado (${o.estado})`);
  if (facturado > 0) {
    avisos.push(`Ya hay $ ${facturado.toLocaleString('es-AR')} facturados de este presupuesto (por ejemplo, señas): ` +
      `el saldo a facturar es $ ${saldo.toLocaleString('es-AR')}. Ajustá los ítems o consultá con el contador cómo descontar los anticipos.`);
  }
  if (yaFacturados.length) avisos.push(`Ya facturados completos y no incluidos: ${yaFacturados.join(', ')}`);
  const serv = lineas.some(l => l.es_servicio);
  return {
    comprobante: {
      tipo_doc: 'factura', receptor: cli ? receptorDeCliente(cli) : { doc_tipo: 99, doc_nro: '0', nombre: 'Consumidor Final', condicion_iva_id: 5 },
      items: lineas, cliente_id: o.cliente_id, origen: 'operacion', operacion_id: o.id, fecha: hoyAR(),
      ...(serv ? { fch_serv_desde: hoyAR(), fch_serv_hasta: hoyAR(), fch_vto_pago: hoyAR() } : {}),
    },
    referencia: `Presupuesto ${String(o.numero).replace(/^OP-/, 'PRO-')}`, total_origen: tot.total, facturado, saldo, avisos,
  };
}

/** Lo que queda por acreditar de una factura (su total menos las notas de crédito ya hechas). */
async function saldoAcreditable(facturaId: string): Promise<number> {
  const { rows: [r] } = await db.query(
    `SELECT f.imp_total - COALESCE((SELECT SUM(imp_total) FROM comprobantes n
                                    WHERE n.comprobante_asociado_id = f.id AND n.tipo_doc = 'nota_credito'
                                      AND n.estado IN ${ESTADOS_QUE_CUENTAN}), 0) AS saldo
       FROM comprobantes f WHERE f.id = $1`, [facturaId]);
  return r ? a2(Number(r.saldo)) : 0;
}

/** Nota de crédito (total) de una factura autorizada: mismo receptor e ítems. */
export async function prepararNotaCredito(facturaId: string): Promise<Propuesta | null> {
  const { rows: [f] } = await db.query(`SELECT * FROM comprobantes WHERE id = $1`, [facturaId]);
  if (!f) return null;
  const { rows: items } = await db.query(`SELECT * FROM comprobante_items WHERE comprobante_id = $1 ORDER BY orden`, [facturaId]);
  const saldo = await saldoAcreditable(facturaId);
  const avisos: string[] = [];
  if (f.estado !== 'autorizado') avisos.push('La factura todavía no está autorizada por ARCA');
  if (f.tipo_doc !== 'factura') avisos.push('Solo se puede hacer una nota de crédito sobre una factura');
  if (saldo < Number(f.imp_total)) avisos.push(`Ya hay notas de crédito sobre esta factura: queda $ ${saldo.toLocaleString('es-AR')} por acreditar`);
  const serv = items.some(i => i.es_servicio);
  return {
    comprobante: {
      tipo_doc: 'nota_credito', comprobante_asociado_id: f.id, cliente_id: f.cliente_id, origen: f.origen,
      operacion_id: f.operacion_id, recibo_id: f.recibo_id, fecha: hoyAR(),
      receptor: {
        doc_tipo: f.receptor_doc_tipo, doc_nro: f.receptor_doc_nro, nombre: f.receptor_nombre,
        domicilio: f.receptor_domicilio, condicion_iva_id: f.receptor_condicion_iva_id,
      },
      items: items.map(i => ({
        descripcion: i.descripcion, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario),
        bonificacion: Number(i.bonificacion), alicuota: Number(i.alicuota), exento: i.exento, es_servicio: i.es_servicio,
        unidad: i.unidad, producto_id: i.producto_id, operacion_item_id: i.operacion_item_id,
      })),
      ...(serv ? { fch_serv_desde: hoyAR(), fch_serv_hasta: hoyAR(), fch_vto_pago: hoyAR() } : {}),
    },
    referencia: `Factura ${f.clase} ${String(f.punto_venta).padStart(5, '0')}-${String(f.numero ?? '').padStart(8, '0')}`,
    total_origen: Number(f.imp_total), facturado: a2(Number(f.imp_total) - saldo), saldo, avisos,
  };
}

/** Nota de débito sobre una factura (recargos, intereses, diferencias): mismo receptor, ítems a cargar. */
export async function prepararNotaDebito(facturaId: string): Promise<Propuesta | null> {
  const nc = await prepararNotaCredito(facturaId);
  if (!nc) return null;
  return {
    ...nc,
    comprobante: {
      ...nc.comprobante, tipo_doc: 'nota_debito', fch_serv_desde: null, fch_serv_hasta: null, fch_vto_pago: null,
      items: [{ descripcion: 'Recargo', cantidad: 1, precio_unitario: 0 }],
    },
    avisos: nc.avisos.filter(a => !a.startsWith('Ya hay notas de crédito')),
  };
}

/** Exceso sobre lo que queda por facturar del origen (0 = dentro del saldo). */
export async function excesoSobreOrigen(input: NuevoComprobante, total: number): Promise<{ exceso: number; referencia: string } | null> {
  if (input.tipo_doc === 'nota_credito' && input.comprobante_asociado_id) {
    const saldo = await saldoAcreditable(input.comprobante_asociado_id);
    return { exceso: a2(Math.max(0, total - saldo)), referencia: 'de la factura asociada' };
  }
  if (input.tipo_doc !== 'factura') return null;
  if (input.remito_id) {
    const p = await prepararDesdeRemito(input.remito_id);
    if (!p) return null;
    return { exceso: a2(Math.max(0, total - p.saldo)), referencia: `del remito (${p.referencia})` };
  }
  if (input.recibo_id) {
    const { rows: [r] } = await db.query(`SELECT numero, monto_total FROM recibos WHERE id = $1`, [input.recibo_id]);
    if (!r) return null;
    const saldo = Number(r.monto_total) - await facturadoDe('recibo_id', input.recibo_id);
    return { exceso: a2(Math.max(0, total - saldo)), referencia: `del recibo ${r.numero}` };
  }
  if (input.operacion_id) {
    const tot = await totalOperacion(input.operacion_id);
    if (!tot) return null;
    const saldo = tot.total - await facturadoDe('operacion_id', input.operacion_id);
    return { exceso: a2(Math.max(0, total - saldo)), referencia: 'del presupuesto' };
  }
  return null;
}

// ── Pendientes de facturar ───────────────────────────────────────────────────

export async function porFacturar() {
  const { rows: recibos } = await db.query(
    `SELECT r.id, r.numero, r.fecha, r.monto_total, r.concepto, r.cliente_id, r.operacion_id,
            o.numero AS operacion_numero,
            COALESCE(NULLIF(TRIM(COALESCE(c.apellido, '') || ' ' || COALESCE(c.nombre, '')), ''), c.razon_social) AS cliente_nombre,
            COALESCE(f.t, 0) AS facturado
       FROM recibos r
       JOIN clientes c ON c.id = r.cliente_id
       LEFT JOIN operaciones o ON o.id = r.operacion_id
       LEFT JOIN LATERAL (SELECT SUM(${SIGNO}) AS t FROM comprobantes WHERE recibo_id = r.id AND estado IN ${ESTADOS_QUE_CUENTAN}) f ON true
      WHERE r.estado = 'emitido' AND r.monto_total - COALESCE(f.t, 0) > 0.009
      ORDER BY r.fecha DESC, r.created_at DESC LIMIT 150`);
  const { rows: operaciones } = await db.query(
    `SELECT o.id, o.numero, o.estado, o.cliente_id, o.created_at,
            COALESCE(NULLIF(TRIM(COALESCE(c.apellido, '') || ' ' || COALESCE(c.nombre, '')), ''), c.razon_social) AS cliente_nombre,
            o.precio_total + COALESCE(o.costo_envio, 0) - COALESCE(d.t, 0) AS total,
            COALESCE(f.t, 0) AS facturado,
            COALESCE(cob.t, 0) AS cobrado
       FROM operaciones o
       JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN LATERAL (SELECT SUM(monto_descuento) AS t FROM recibos WHERE operacion_id = o.id AND estado = 'emitido') d ON true
       LEFT JOIN LATERAL (SELECT SUM(monto_total) AS t FROM recibos WHERE operacion_id = o.id AND estado = 'emitido') cob ON true
       LEFT JOIN LATERAL (SELECT SUM(${SIGNO}) AS t FROM comprobantes WHERE operacion_id = o.id AND estado IN ${ESTADOS_QUE_CUENTAN}) f ON true
      WHERE o.estado IN ${ESTADOS_OPERACION_FACTURABLE}
        AND o.precio_total + COALESCE(o.costo_envio, 0) - COALESCE(d.t, 0) - COALESCE(f.t, 0) > 0.009
      ORDER BY o.created_at DESC LIMIT 150`);
  const { rows: remitos } = await db.query(
    `SELECT m.id, m.numero, m.estado, m.fecha_emision, m.cliente_id, m.operacion_id, o.numero AS operacion_numero,
            COALESCE(NULLIF(TRIM(COALESCE(c.apellido, '') || ' ' || COALESCE(c.nombre, '')), ''), c.razon_social) AS cliente_nombre,
            COALESCE(f.t, 0) AS facturado
       FROM remitos m
       JOIN clientes c ON c.id = m.cliente_id
       LEFT JOIN operaciones o ON o.id = m.operacion_id
       LEFT JOIN LATERAL (SELECT SUM(${SIGNO}) AS t FROM comprobantes WHERE remito_id = m.id AND estado IN ${ESTADOS_QUE_CUENTAN}) f ON true
      WHERE m.estado IN ('emitido', 'entregado') AND COALESCE(f.t, 0) = 0
      ORDER BY m.fecha_emision DESC, m.created_at DESC LIMIT 150`);
  const n = (v: unknown) => Number(v);
  return {
    remitos: remitos.map(m => ({ ...m, operacion_numero: m.operacion_numero ? String(m.operacion_numero).replace(/^OP-/, 'PRO-') : null, facturado: n(m.facturado) })),
    recibos: recibos.map(r => ({ ...r, monto_total: n(r.monto_total), facturado: n(r.facturado), saldo: a2(n(r.monto_total) - n(r.facturado)) })),
    operaciones: operaciones.map(o => ({
      ...o, numero: String(o.numero).replace(/^OP-/, 'PRO-'), total: n(o.total), facturado: n(o.facturado), cobrado: n(o.cobrado),
      saldo: a2(n(o.total) - n(o.facturado)),
    })),
  };
}

export async function tablero() {
  const mes = hoyAR().slice(0, 7);
  const { rows: [t] } = await db.query(
    `SELECT
       COALESCE(SUM(${SIGNO}) FILTER (WHERE estado IN ('autorizado', 'contingencia') AND to_char(fecha, 'YYYY-MM') = $1), 0) AS facturado_mes,
       COUNT(*) FILTER (WHERE estado IN ('autorizado', 'contingencia') AND tipo_doc = 'factura' AND clase = 'A' AND to_char(fecha, 'YYYY-MM') = $1) AS facturas_a_mes,
       COUNT(*) FILTER (WHERE estado IN ('autorizado', 'contingencia') AND tipo_doc = 'factura' AND clase = 'B' AND to_char(fecha, 'YYYY-MM') = $1) AS facturas_b_mes,
       COUNT(*) FILTER (WHERE estado IN ('autorizado', 'contingencia') AND tipo_doc = 'nota_credito' AND to_char(fecha, 'YYYY-MM') = $1) AS notas_credito_mes,
       COUNT(*) FILTER (WHERE estado = 'contingencia') AS en_contingencia,
       COUNT(*) FILTER (WHERE estado IN ('borrador', 'rechazado')) AS pendientes,
       COUNT(*) FILTER (WHERE estado IN ('incierto', 'emitiendo')) AS sin_confirmar
     FROM comprobantes`, [mes]);
  const n = (v: unknown) => Number(v);
  return {
    facturado_mes: a2(n(t.facturado_mes)), facturas_a_mes: n(t.facturas_a_mes), facturas_b_mes: n(t.facturas_b_mes),
    notas_credito_mes: n(t.notas_credito_mes), pendientes: n(t.pendientes), sin_confirmar: n(t.sin_confirmar),
    en_contingencia: n(t.en_contingencia),
  };
}
