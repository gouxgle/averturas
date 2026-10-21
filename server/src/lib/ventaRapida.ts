import { crearSeguimientoPorEntrega } from './postventa.js';
import type { PoolClient } from 'pg';
import { siguienteNumero } from './numeracion.js';

type Queryable = Pick<PoolClient, 'query'>;

// Partes que comparten la venta rápida de mostrador (routes/operaciones.ts) y el cambio de producto
// (lib/cambios.ts): validar el stock con las filas bloqueadas y entregar los ítems en el momento
// (remito + egreso de stock). La plata (recibos) y la operación quedan en cada caller: difieren.

export class VentaError extends Error {
  constructor(message: string, public status: 404 | 409 | 422) { super(message); }
}

export interface ItemMostrador {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

// Valida stock suficiente DENTRO de la transacción, con lock de fila (FOR UPDATE) sobre los productos
// involucrados. Sin esto, dos ventas simultáneas del mismo producto podrían leer el mismo stock disponible
// antes de que ninguna descuente nada y sobrevender: el lock serializa cualquier otra transacción que
// también bloquee esas filas (incluida la emisión de remitos tradicionales).
//
// OJO: el lock y el cálculo de stock van en dos SELECT separados. Si van en el mismo SELECT ... FOR UPDATE,
// el re-chequeo de Postgres al desbloquearse (EvalPlanQual) sólo refresca las columnas propias de la fila
// bloqueada — la subquery correlacionada contra stock_movimientos se sigue evaluando con el snapshot
// ORIGINAL, que todavía no ve los movimientos recién commiteados por quien liberó el lock. Con dos SELECT,
// el segundo arranca su propio snapshot ya con el lock en mano y sí ve los datos frescos.
export async function bloquearYValidarStock(
  client: Queryable, items: { producto_id: string; descripcion: string; cantidad: number }[],
): Promise<void> {
  const productoIds = [...new Set(items.map(i => i.producto_id))];
  await client.query(`SELECT id FROM catalogo_productos WHERE id = ANY($1::uuid[]) FOR UPDATE`, [productoIds]);
  const { rows: productosLock } = await client.query(`
    SELECT cp.id, cp.nombre,
      (COALESCE(cp.stock_inicial, 0) + COALESCE((
        SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
      ), 0))::int AS stock_actual
    FROM catalogo_productos cp
    WHERE cp.id = ANY($1::uuid[])
  `, [productoIds]);
  const stockPorProducto = new Map(productosLock.map(p => [p.id as string, p]));

  // Un mismo producto repetido en dos renglones se valida por el total.
  const pedido = new Map<string, number>();
  for (const it of items) pedido.set(it.producto_id, (pedido.get(it.producto_id) ?? 0) + it.cantidad);
  for (const item of items) {
    const prod = stockPorProducto.get(item.producto_id);
    if (!prod) throw new VentaError(`Producto no encontrado: ${item.descripcion}`, 404);
    if (prod.stock_actual < (pedido.get(item.producto_id) ?? item.cantidad)) {
      throw new VentaError(`Stock insuficiente para "${prod.nombre}": disponible ${prod.stock_actual}, pedido ${pedido.get(item.producto_id) ?? item.cantidad}`, 422);
    }
  }
}

export async function insertarItemsOperacion(client: Queryable, operacionId: string, items: ItemMostrador[]): Promise<void> {
  for (const [idx, item] of items.entries()) {
    await client.query(`
      INSERT INTO operacion_items (operacion_id, orden, producto_id, descripcion, cantidad, precio_unitario)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [operacionId, idx, item.producto_id, item.descripcion, item.cantidad, item.precio_unitario]);
  }
}

export interface RemitoMostrador { id: string; numero: string; estado: 'emitido' | 'entregado' }

// Remito de la venta: nace en borrador, se emite descontando stock y, si el cliente retira ahora, queda
// entregado (y la operación cerrada). Mismo patrón que remitos.ts PATCH /:id/estado.
export async function entregarDeMostrador(client: Queryable, d: {
  operacion_id: string; cliente_id: string; items: ItemMostrador[]; nota: string; motivoStock: string;
  medioEnvio: string; direccionEntrega?: string | null; costoEnvio?: number; retiraAhora: boolean; userId: string | null;
}): Promise<RemitoMostrador> {
  const numeroRemito = await siguienteNumero(client as PoolClient, 'remitos', 'R');
  const { rows: [remito] } = await client.query(`
    INSERT INTO remitos (numero, cliente_id, operacion_id, medio_envio, direccion_entrega, costo_envio, notas, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
  `, [numeroRemito, d.cliente_id, d.operacion_id, d.medioEnvio, d.direccionEntrega || null, d.costoEnvio ?? 0, d.nota, d.userId]);

  for (const item of d.items) {
    await client.query(`
      INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad, precio_unitario, estado_producto)
      VALUES ($1,$2,$3,$4,$5,'nuevo')
    `, [remito.id, item.producto_id, item.descripcion, item.cantidad, item.precio_unitario]);
  }

  // borrador → emitido: descuenta stock
  for (const item of d.items) {
    await client.query(`
      INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
      VALUES ($1,'egreso_remito',$2,$3,$4,$5,$6)
    `, [item.producto_id, -Math.abs(item.cantidad), d.motivoStock, d.operacion_id, numeroRemito, d.userId]);
  }
  await client.query(`UPDATE remitos SET estado='emitido', stock_descontado=true WHERE id=$1`, [remito.id]);

  // Si el stock de algún producto quedó en 0, ya no puede seguir "exhibido en salón"
  await client.query(`
    UPDATE catalogo_productos cp SET en_salon = false
    WHERE cp.id = ANY($1::uuid[]) AND cp.en_salon = true
      AND (COALESCE(cp.stock_inicial,0) + COALESCE((
        SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
      ), 0)) <= 0
  `, [d.items.map(i => i.producto_id)]);

  // Si el cliente retira ahora: emitido → entregado, y la operación queda cerrada
  if (d.retiraAhora) {
    await client.query(`
      UPDATE remitos SET estado='entregado', fecha_entrega_real=CURRENT_DATE, recepcion_estado='conforme' WHERE id=$1
    `, [remito.id]);
    await client.query(`UPDATE operaciones SET estado='entregado', updated_at=now() WHERE id=$1`, [d.operacion_id]);
    await crearSeguimientoPorEntrega(client, remito.id);
  }
  return { id: remito.id as string, numero: numeroRemito, estado: d.retiraAhora ? 'entregado' : 'emitido' };
}
