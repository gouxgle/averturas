import type { PoolClient } from 'pg';
import { aCent } from './fiscal/calculo.js';
import { siguienteNumero } from './numeracion.js';
import { asentarSaldoFavor, FORMA_PAGO_SALDO_FAVOR } from './saldoFavor.js';
import { crearDevolucion, DevolucionError, type EntradaDevolucion, type DevolucionCreada } from './devoluciones.js';
import { bloquearYValidarStock, insertarItemsOperacion, entregarDeMostrador, type ItemMostrador } from './ventaRapida.js';

type Queryable = Pick<PoolClient, 'query'>;

const dePesos = (c: number) => c / 100;

export interface EntradaCambio extends EntradaDevolucion {
  cambio: {
    items: ItemMostrador[];
    /** Cómo paga el cliente lo que falta si el producto nuevo cuesta más; null = queda pendiente de cobro. */
    pago_diferencia?: { forma_pago: string; referencia?: string | null } | null;
  };
}

export interface CambioCreado {
  devolucion: DevolucionCreada;
  operacion: { id: string; numero: string; total: number };
  remito: { id: string; numero: string };
  /** Del producto nuevo: lo cubierto con el crédito de la devolución, lo que paga el cliente y lo que queda pendiente. */
  pagado_con_saldo_favor: number;
  diferencia_cobrada: number;
  diferencia_pendiente: number;
  recibos: { id: string; numero: string; forma_pago: string; monto: number }[];
}

// Cambio de producto: la devolución y la venta del producto nuevo son UNA operación (todo o nada).
//   E = lo que sobra de la devolución (plata que el cliente ya había pagado)
//   T = total del producto nuevo
//   U = min(E, T)  se paga con ese crédito (recibo «Saldo a favor», no es caja)
//   T − U          lo paga el cliente ahora con el medio que elija (recibo) o queda pendiente
//   E − U          sobra: se devuelve en dinero (reintegro) o queda a favor, según `reintegro`
// La operación nueva es aparte (es_cambio) y se entrega en el momento; la original no se toca.
export async function crearCambio(client: Queryable, entrada: EntradaCambio, user: { id: string | null; rol: string }): Promise<CambioCreado> {
  const items = entrada.cambio.items;
  if (items.length === 0) throw new DevolucionError('Elegí el producto que se lleva a cambio', 422);
  // El stock del producto nuevo se bloquea y valida primero: si no hay, no se registra nada.
  await bloquearYValidarStock(client, items);

  const dev = await crearDevolucion(client, entrada, user);
  const eC = aCent(dev.credito_monto + dev.reintegro_monto);   // lo que sobra de la devolución
  const tC = items.reduce((a, i) => a + aCent(i.precio_unitario) * i.cantidad, 0);
  const uC = Math.min(eC, tC);
  // Lo que se usa para pagar el cambio tiene que seguir a favor: solo el sobrante se puede devolver en dinero.
  if (aCent(dev.reintegro_monto) > eC - uC) {
    throw new DevolucionError(`En dinero se pueden devolver hasta $ ${dePesos(eC - uC).toLocaleString('es-AR')}: el resto se usa para pagar el producto nuevo.`, 422);
  }

  // Operación del producto nuevo (ya aprobada, se entrega ahora)
  const { rows: [op] } = await client.query(`
    INSERT INTO operaciones (tipo, estado, cliente_id, vendedor_id, created_by, forma_pago, forma_envio, notas, es_cambio, devolucion_origen_id)
    VALUES ('estandar', 'aprobado', $1, $2, $2, $3, 'retiro_local', $4, true, $5)
    RETURNING id, numero
  `, [dev.cliente_id, user.id, entrada.cambio.pago_diferencia?.forma_pago ?? FORMA_PAGO_SALDO_FAVOR,
    `Cambio de producto — devolución ${dev.numero}`, dev.id]);
  await insertarItemsOperacion(client, op.id, items);
  // El trigger recalcular_totales_operacion completa operaciones.precio_total
  const { rows: [{ precio_total }] } = await client.query(`SELECT precio_total FROM operaciones WHERE id = $1`, [op.id]);
  if (aCent(Number(precio_total)) !== tC) throw new DevolucionError('El total del producto nuevo no coincide con sus ítems', 409);

  const recibos: CambioCreado['recibos'] = [];
  const emitirRecibo = async (monto: number, formaPago: string, concepto: string, referencia?: string | null) => {
    const numero = await siguienteNumero(client as PoolClient, 'recibos', 'REC');
    const { rows: [r] } = await client.query(`
      INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, forma_pago, referencia_pago, concepto, monto_lista, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $4, $8)
      RETURNING id
    `, [numero, dev.cliente_id, op.id, monto, formaPago, referencia ?? null, concepto, user.id]);
    await client.query(`INSERT INTO recibo_items (recibo_id, descripcion, cantidad, monto, orden) VALUES ($1, $2, 1, $3, 0)`, [r.id, concepto, monto]);
    recibos.push({ id: r.id as string, numero, forma_pago: formaPago, monto });
    return r.id as string;
  };

  // 1) El crédito de la devolución paga (todo o parte de) el producto nuevo
  if (uC > 0) {
    const reciboId = await emitirRecibo(dePesos(uC), FORMA_PAGO_SALDO_FAVOR, `Cambio — saldo a favor de ${dev.numero}`);
    await asentarSaldoFavor(client, {
      cliente_id: dev.cliente_id, tipo: 'consumo_recibo', monto: dePesos(uC), recibo_id: reciboId, devolucion_id: dev.id,
      descripcion: `Pago del cambio ${op.numero}`, created_by: user.id,
    });
  }
  // 2) Lo que falta lo paga el cliente ahora (o queda pendiente de cobro en la operación)
  const dC = tC - uC;
  let cobradaC = 0;
  if (dC > 0 && entrada.cambio.pago_diferencia) {
    await emitirRecibo(dePesos(dC), entrada.cambio.pago_diferencia.forma_pago, `Diferencia del cambio ${op.numero}`, entrada.cambio.pago_diferencia.referencia);
    cobradaC = dC;
  }

  const remito = await entregarDeMostrador(client, {
    operacion_id: op.id, cliente_id: dev.cliente_id, items, nota: `Cambio de producto — devolución ${dev.numero}`,
    motivoStock: `Cambio de producto (${dev.numero})`, medioEnvio: 'retiro_local', retiraAhora: true, userId: user.id,
  });
  await client.query(`UPDATE devoluciones SET operacion_cambio_id = $2, updated_at = now() WHERE id = $1`, [dev.id, op.id]);

  return {
    devolucion: dev,
    operacion: { id: op.id, numero: op.numero, total: dePesos(tC) },
    remito: { id: remito.id, numero: remito.numero },
    pagado_con_saldo_favor: dePesos(uC), diferencia_cobrada: dePesos(cobradaC), diferencia_pendiente: dePesos(dC - cobradaC),
    recibos,
  };
}
