import type { PoolClient } from 'pg';
import { aCent } from './fiscal/calculo.js';
import { facturadoPorItem } from './fiscal/origenes.js';
import { nombreItem } from './nombreItem.js';
import { siguienteNumero } from './numeracion.js';
import { asentarSaldoFavor } from './saldoFavor.js';
import { crearReintegro, type FormaReintegro } from './reintegros.js';

type Queryable = Pick<PoolClient, 'query'>;

export class DevolucionError extends Error {
  constructor(message: string, public status: 403 | 404 | 409 | 422) { super(message); }
}

const dePesos = (c: number) => c / 100;

// ── Cálculo (puro) ───────────────────────────────────────────────────

export interface LineaCalculo { cantidad: number; precio_bruto: number }

export interface ResultadoCalculo {
  /** Bonificación de la operación como fracción del precio total (0 a 1). */
  factor: number;
  lineas: { cantidad: number; precio_bruto: number; descuento_unitario: number; precio_neto: number; subtotal: number }[];
  valor_total: number;
  /** Lo que baja la deuda que el cliente todavía tenía con la operación. */
  aplicado_a_saldo: number;
  /** Lo que sobra: dinero que ya había cobrado y que vuelve (reintegro) o queda a favor. */
  excedente: number;
}

// Valor de lo devuelto y cómo se reparte. Todo en centavos enteros (aCent) para no perder uno.
//  - Cada unidad vale su precio menos la bonificación proporcional que tuvo la operación
//    (la bonificación no es plata que el cliente haya puesto, así que no se devuelve).
//    Instalación y envío no se reintegran: son servicios ya prestados.
//  - Primero se baja lo que el cliente todavía debía; recién el resto es plata a favor.
export function calcularDevolucion(e: {
  precio_total: number; descuentos: number; saldo_previo: number; lineas: LineaCalculo[];
}): ResultadoCalculo {
  const factor = e.precio_total > 0 ? Math.min(Math.max(e.descuentos / e.precio_total, 0), 1) : 0;
  let valorC = 0;
  const lineas = e.lineas.map(l => {
    const brutoC = aCent(l.precio_bruto);
    const netoC = aCent(l.precio_bruto * (1 - factor));
    valorC += netoC * l.cantidad;
    return {
      cantidad: l.cantidad, precio_bruto: dePesos(brutoC), descuento_unitario: dePesos(brutoC - netoC),
      precio_neto: dePesos(netoC), subtotal: dePesos(netoC * l.cantidad),
    };
  });
  const aplicadoC = Math.min(valorC, Math.max(aCent(e.saldo_previo), 0));
  return { factor, lineas, valor_total: dePesos(valorC), aplicado_a_saldo: dePesos(aplicadoC), excedente: dePesos(valorC - aplicadoC) };
}

// ── Qué se puede devolver ────────────────────────────────────────────

export interface LineaDevolvible {
  remito_item_id: string;
  remito_id: string;
  remito_numero: string;
  operacion_item_id: string | null;
  producto_id: string | null;
  producto_codigo: string | null;
  tipo_abertura_nombre: string | null;
  descripcion: string;
  nombre: string;
  tipo_item: string | null;
  entregado: number;
  devuelto: number;
  /** Lo que todavía se puede devolver: entregado menos lo ya devuelto. */
  maximo: number;
  precio_bruto: number | null;
  /** Sin precio ni en el remito ni en el presupuesto: hay que cargarlo a mano. */
  sin_precio: boolean;
  /** Parte de este ítem ya estaba facturada: pide la nota de crédito. */
  facturado: boolean;
  /** Motivo por el que no se puede devolver (servicio), o aviso (a medida). */
  bloqueo: string | null;
  aviso: string | null;
}

export interface PreparacionDevolucion {
  cliente_id: string;
  operacion_id: string | null;
  remito_id: string | null;
  operacion: { id: string; numero: string; precio_total: number; cobrado: number; descuentos: number; devuelto_a_saldo: number; saldo: number } | null;
  lineas: LineaDevolvible[];
}

const AVISO_A_MEDIDA = 'Producto a medida: según los términos de la proforma no admite devolución. Solo un administrador puede registrarlo y no vuelve a stock.';

// Líneas de remitos EMITIDOS o ENTREGADOS (lo que físicamente salió) con lo ya devuelto.
async function cargarLineas(q: Queryable, filtro: { remitoId?: string; operacionId?: string; itemIds?: string[] }): Promise<LineaDevolvible[]> {
  const cond = filtro.itemIds ? 'ri.id = ANY($1::uuid[])' : filtro.remitoId ? 'rm.id = $1' : 'rm.operacion_id = $1';
  const param = filtro.itemIds ?? filtro.remitoId ?? filtro.operacionId;
  const { rows } = await q.query(`
    SELECT ri.id AS remito_item_id, ri.remito_id, rm.numero AS remito_numero, rm.operacion_id,
           ri.operacion_item_id, ri.producto_id, ri.descripcion, ri.cantidad AS entregado,
           ri.precio_unitario AS precio_remito,
           oi.tipo_item, oi.precio_unitario AS precio_op,
           p.codigo AS producto_codigo, COALESCE(ta_oi.nombre, ta_p.nombre) AS tipo_abertura_nombre,
           COALESCE((SELECT SUM(di.cantidad) FROM devolucion_items di
                      JOIN devoluciones d ON d.id = di.devolucion_id AND d.estado = 'emitida'
                     WHERE di.remito_item_id = ri.id), 0)::int AS devuelto
    FROM remito_items ri
    JOIN remitos rm ON rm.id = ri.remito_id
    LEFT JOIN operacion_items oi ON oi.id = ri.operacion_item_id
    LEFT JOIN catalogo_productos p ON p.id = ri.producto_id
    LEFT JOIN tipos_abertura ta_oi ON ta_oi.id = oi.tipo_abertura_id
    LEFT JOIN tipos_abertura ta_p ON ta_p.id = p.tipo_abertura_id
    WHERE rm.estado IN ('emitido', 'entregado') AND ${cond}
    ORDER BY rm.created_at, ri.id
  `, [param]);

  const facturados = new Map<string, Map<string, number>>();
  for (const opId of new Set(rows.map(r => r.operacion_id as string | null).filter((x): x is string => !!x))) {
    facturados.set(opId, await facturadoPorItem(opId));
  }

  return rows.map(r => {
    const precioOp = Number(r.precio_op ?? 0), precioRem = Number(r.precio_remito ?? 0);
    const precio = precioOp > 0 ? precioOp : precioRem > 0 ? precioRem : null;
    const entregado = Number(r.entregado), devuelto = Number(r.devuelto);
    const esServicio = r.tipo_item === 'servicio';
    const facturado = !!r.operacion_item_id && (facturados.get(r.operacion_id)?.get(r.operacion_item_id) ?? 0) > 0;
    return {
      remito_item_id: r.remito_item_id, remito_id: r.remito_id, remito_numero: r.remito_numero,
      operacion_item_id: r.operacion_item_id, producto_id: r.producto_id,
      producto_codigo: r.producto_codigo, tipo_abertura_nombre: r.tipo_abertura_nombre,
      descripcion: r.descripcion,
      nombre: nombreItem(r.descripcion, r.producto_codigo, esServicio ? null : r.tipo_abertura_nombre),
      tipo_item: r.tipo_item,
      entregado, devuelto, maximo: esServicio ? 0 : Math.max(entregado - devuelto, 0),
      precio_bruto: precio, sin_precio: precio === null, facturado,
      bloqueo: esServicio ? 'Un servicio ya prestado no se devuelve.' : null,
      aviso: r.tipo_item === 'a_medida' ? AVISO_A_MEDIDA : null,
    } as LineaDevolvible;
  });
}

async function cobranzaDe(q: Queryable, operacionId: string) {
  const { rows: [o] } = await q.query(`
    SELECT o.id, o.numero, oc.precio_total, oc.cobrado, oc.descuentos, oc.devuelto_a_saldo, oc.saldo
    FROM operaciones o JOIN operacion_cobranza oc ON oc.operacion_id = o.id WHERE o.id = $1
  `, [operacionId]);
  if (!o) return null;
  return {
    id: o.id as string, numero: o.numero as string, precio_total: Number(o.precio_total), cobrado: Number(o.cobrado),
    descuentos: Number(o.descuentos), devuelto_a_saldo: Number(o.devuelto_a_saldo), saldo: Number(o.saldo),
  };
}

export async function prepararDevolucion(q: Queryable, origen: { remito_id?: string | null; operacion_id?: string | null }): Promise<PreparacionDevolucion> {
  let operacionId = origen.operacion_id ?? null;
  let remitoId = origen.remito_id ?? null;
  let clienteId: string;
  if (remitoId) {
    const { rows: [rm] } = await q.query(`SELECT id, cliente_id, operacion_id, estado FROM remitos WHERE id = $1`, [remitoId]);
    if (!rm) throw new DevolucionError('Remito no encontrado', 404);
    if (!['emitido', 'entregado'].includes(rm.estado)) {
      throw new DevolucionError(`El remito está ${rm.estado}: solo se devuelve mercadería de un remito emitido o entregado.`, 409);
    }
    clienteId = rm.cliente_id; operacionId = rm.operacion_id;
  } else if (operacionId) {
    const { rows: [o] } = await q.query(`SELECT id, cliente_id FROM operaciones WHERE id = $1`, [operacionId]);
    if (!o) throw new DevolucionError('Operación no encontrada', 404);
    clienteId = o.cliente_id;
  } else {
    throw new DevolucionError('Indicá el remito o la operación a devolver', 422);
  }
  const lineas = await cargarLineas(q, remitoId ? { remitoId } : { operacionId: operacionId! });
  return {
    cliente_id: clienteId, operacion_id: operacionId, remito_id: remitoId,
    operacion: operacionId ? await cobranzaDe(q, operacionId) : null, lineas,
  };
}

// ── Crear la devolución ──────────────────────────────────────────────

export interface EntradaDevolucion {
  remito_id?: string | null;
  operacion_id?: string | null;
  motivo: string;
  items: {
    remito_item_id: string; cantidad: number; destino: 'stock' | 'no_reingresa';
    motivo_item?: string | null; estado_producto?: 'nuevo' | 'bueno' | 'con_detalles';
    /** Solo se usa si el ítem no tiene precio ni en el remito ni en el presupuesto. */
    precio_unitario?: number | null;
  }[];
  /** Parte del excedente que se devuelve en dinero (sale de caja); el resto queda a favor del cliente. */
  reintegro?: { monto: number; forma_pago: FormaReintegro; referencia?: string | null } | null;
}

export interface DevolucionCreada {
  id: string; numero: string; cliente_id: string; operacion_id: string | null;
  valor_total: number; aplicado_a_saldo: number; reintegro_monto: number; credito_monto: number; requiere_nc: boolean;
  reintegro_numero: string | null;
}

// Corre dentro de la transacción del llamador (ya con BEGIN). Recalcula TODO en el servidor:
// de lo que manda el navegador solo se toman los ítems y las cantidades.
export async function crearDevolucion(
  client: Queryable, entrada: EntradaDevolucion, user: { id: string | null; rol: string },
): Promise<DevolucionCreada> {
  const ids = entrada.items.map(i => i.remito_item_id);
  if (new Set(ids).size !== ids.length) throw new DevolucionError('Un ítem del remito está repetido en la devolución', 422);

  // Se bloquean los remitos involucrados: dos devoluciones simultáneas del mismo ítem se ordenan.
  await client.query(
    `SELECT rm.id FROM remitos rm WHERE rm.id IN (SELECT remito_id FROM remito_items WHERE id = ANY($1::uuid[])) FOR UPDATE`, [ids]);
  const lineas = await cargarLineas(client, { itemIds: ids });
  const porId = new Map(lineas.map(l => [l.remito_item_id, l]));

  const { rows: remitos } = await client.query(
    `SELECT DISTINCT rm.cliente_id, rm.operacion_id FROM remitos rm JOIN remito_items ri ON ri.remito_id = rm.id WHERE ri.id = ANY($1::uuid[])`, [ids]);
  if (remitos.length !== 1) throw new DevolucionError('Los ítems tienen que ser del mismo cliente y de la misma operación', 422);
  const { cliente_id: clienteId, operacion_id: operacionId } = remitos[0] as { cliente_id: string; operacion_id: string | null };

  const armadas: { linea: LineaDevolvible; cantidad: number; destino: 'stock' | 'no_reingresa'; motivo_item: string | null; estado_producto: string; precio: number }[] = [];
  for (const it of entrada.items) {
    const l = porId.get(it.remito_item_id);
    if (!l) throw new DevolucionError('Un ítem no existe o su remito no está emitido ni entregado', 404);
    if (l.bloqueo) throw new DevolucionError(`${l.nombre}: ${l.bloqueo}`, 422);
    if (it.cantidad > l.maximo) {
      throw new DevolucionError(`${l.nombre}: se entregaron ${l.entregado}, ya se devolvieron ${l.devuelto}; no se pueden devolver ${it.cantidad}.`, 409);
    }
    let destino = it.destino;
    if (l.tipo_item === 'a_medida') {
      if (user.rol !== 'admin') throw new DevolucionError(`${l.nombre}: es un producto a medida, solo un administrador puede registrar su devolución.`, 403);
      destino = 'no_reingresa';   // no hay stock de a medida
    }
    if (destino === 'stock' && !l.producto_id) {
      throw new DevolucionError(`${l.nombre}: no es un producto del catálogo, no puede volver a stock.`, 422);
    }
    // A medida: el motivo es implícito (no hay stock de a medida), no hace falta pedirlo.
    const motivoItem = it.motivo_item?.trim() || (l.tipo_item === 'a_medida' ? 'Producto a medida' : null);
    if (destino === 'no_reingresa' && !motivoItem) {
      throw new DevolucionError(`${l.nombre}: si no vuelve a stock, indicá el motivo (falla, rotura, a medida…).`, 422);
    }
    const precio = l.precio_bruto ?? (it.precio_unitario && it.precio_unitario > 0 ? it.precio_unitario : null);
    if (precio === null) throw new DevolucionError(`${l.nombre}: no tiene precio en el remito ni en el presupuesto; cargalo a mano.`, 422);
    armadas.push({ linea: l, cantidad: it.cantidad, destino, motivo_item: motivoItem, estado_producto: it.estado_producto ?? 'nuevo', precio });
  }

  // Con operación: la fila se bloquea y el saldo se lee ya bloqueada.
  let cobranza: Awaited<ReturnType<typeof cobranzaDe>> = null;
  if (operacionId) {
    await client.query(`SELECT id FROM operaciones WHERE id = $1 FOR UPDATE`, [operacionId]);
    cobranza = await cobranzaDe(client, operacionId);
  }
  const calc = calcularDevolucion({
    precio_total: cobranza?.precio_total ?? 0, descuentos: cobranza?.descuentos ?? 0,
    saldo_previo: cobranza?.saldo ?? 0,   // sin operación no hay deuda que bajar: todo es plata a favor
    lineas: armadas.map(a => ({ cantidad: a.cantidad, precio_bruto: a.precio })),
  });

  // Lo devuelto en dinero o crédito nunca puede superar lo que el cliente efectivamente cobró.
  if (cobranza && calc.excedente > 0) {
    const { rows: [prev] } = await client.query(
      `SELECT COALESCE(SUM(reintegro_monto + credito_monto), 0) AS ya FROM devoluciones WHERE operacion_id = $1 AND estado = 'emitida'`, [operacionId]);
    if (aCent(Number(prev.ya) + calc.excedente) > aCent(cobranza.cobrado)) {
      throw new DevolucionError('Lo que se devolvería en dinero o saldo a favor supera lo cobrado de esta operación.', 409);
    }
  }

  // Del excedente, lo que se devuelve en dinero y lo que queda a favor (en centavos, sin perder uno).
  const reintegroC = entrada.reintegro ? aCent(entrada.reintegro.monto) : 0;
  const excedenteC = aCent(calc.excedente);
  if (reintegroC > 0 && excedenteC <= 0) {
    throw new DevolucionError('Esta devolución no deja plata a favor del cliente: no hay nada para devolver en dinero.', 422);
  }
  if (reintegroC > excedenteC) {
    throw new DevolucionError(`Se pueden devolver en dinero hasta $ ${calc.excedente.toLocaleString('es-AR')} (lo que ya había pagado el cliente), no $ ${entrada.reintegro!.monto.toLocaleString('es-AR')}.`, 422);
  }
  const reintegroMonto = dePesos(reintegroC);
  const creditoMonto = dePesos(excedenteC - reintegroC);

  const numero = await siguienteNumero(client as PoolClient, 'devoluciones', 'DEV');
  const requiereNc = armadas.some(a => a.linea.facturado);
  const { rows: [dev] } = await client.query(`
    INSERT INTO devoluciones
      (numero, cliente_id, operacion_id, remito_id, motivo, valor_total, aplicado_a_saldo, reintegro_monto, credito_monto, requiere_nc, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [numero, clienteId, operacionId, entrada.remito_id ?? null, entrada.motivo.trim(),
    calc.valor_total, calc.aplicado_a_saldo, reintegroMonto, creditoMonto, requiereNc, user.id]);

  for (let i = 0; i < armadas.length; i++) {
    const a = armadas[i], c = calc.lineas[i], l = a.linea;
    await client.query(`
      INSERT INTO devolucion_items
        (devolucion_id, operacion_item_id, remito_item_id, producto_id, descripcion, tipo_item, cantidad,
         precio_unitario_bruto, descuento_unitario, precio_unitario_neto, destino, motivo_item, estado_producto)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    `, [dev.id, l.operacion_item_id, l.remito_item_id, l.producto_id, l.nombre, l.tipo_item, a.cantidad,
      c.precio_bruto, c.descuento_unitario, c.precio_neto, a.destino, a.motivo_item, a.estado_producto]);
    // "No reingresa" no mueve stock: la mercadería ya salió con el remito y queda registrada como pérdida.
    if (a.destino === 'stock' && l.producto_id) {
      await client.query(`
        INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
        VALUES ($1, 'devolucion_cliente', $2, $3, $4, $5, $6)
      `, [l.producto_id, a.cantidad, `Devolución ${numero}`, operacionId, numero, user.id]);
    }
  }

  // Solo lo que queda a favor entra al libro: lo que se devuelve en dinero nunca se acredita (sale de caja).
  if (creditoMonto > 0) {
    await asentarSaldoFavor(client, {
      cliente_id: clienteId, tipo: 'credito_devolucion', monto: creditoMonto, devolucion_id: dev.id,
      descripcion: `Devolución ${numero}`, created_by: user.id,
    });
  }
  let reintegroNumero: string | null = null;
  if (reintegroC > 0 && entrada.reintegro) {
    const rei = await crearReintegro(client, {
      cliente_id: clienteId, devolucion_id: dev.id, operacion_id: operacionId, monto: reintegroMonto,
      forma_pago: entrada.reintegro.forma_pago, referencia: entrada.reintegro.referencia,
      motivo: `Devolución ${numero}`, userId: user.id,
    });
    reintegroNumero = rei.numero;
  }

  return {
    id: dev.id, numero, cliente_id: clienteId, operacion_id: operacionId, valor_total: calc.valor_total,
    aplicado_a_saldo: calc.aplicado_a_saldo, reintegro_monto: reintegroMonto, credito_monto: creditoMonto,
    requiere_nc: requiereNc, reintegro_numero: reintegroNumero,
  };
}

