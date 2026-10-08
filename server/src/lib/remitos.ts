import { db } from '../db.js';

type Queryable = { query: typeof db.query };

// La entrega programada en el remito es la fuente de verdad; la tarea es su
// proyección en la agenda del CRM — mismo patrón que sincronizarTarea() en
// lib/oportunidades.ts. Idempotente: si tarea_id quedó NULL (se borró a
// mano), la regenera.
export async function sincronizarTareaEntrega(q: Queryable, remitoId: string): Promise<void> {
  const { rows: [r] } = await q.query(
    `SELECT id, cliente_id, operacion_id, tarea_id, fecha_entrega_est, hora_entrega_est, created_by
     FROM remitos WHERE id = $1`,
    [remitoId]
  );
  if (!r || !r.fecha_entrega_est) return;

  const horaTxt = r.hora_entrega_est ? ` a las ${String(r.hora_entrega_est).slice(0, 5)}hs` : '';
  const descripcion = `Entrega programada${horaTxt}`;

  if (r.tarea_id) {
    await q.query(
      `UPDATE tareas SET descripcion = $1, vencimiento = $2, hora = $4, completada = false, completada_at = NULL
       WHERE id = $3`,
      [descripcion, r.fecha_entrega_est, r.tarea_id, r.hora_entrega_est ?? null]
    );
    return;
  }

  const { rows: [tarea] } = await q.query(
    `INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, created_by, hora)
     VALUES ($1, $2, $3, $4, 'normal', 'entrega', $5, $6)
     RETURNING id`,
    [r.cliente_id, r.operacion_id, descripcion, r.fecha_entrega_est, r.created_by, r.hora_entrega_est ?? null]
  );
  await q.query(`UPDATE remitos SET tarea_id = $1 WHERE id = $2`, [tarea.id, remitoId]);
}

// Al entregar o cancelar el remito, la tarea espejo se marca completada —
// no se borra, queda de historial en la agenda.
export async function completarTareaDeEntrega(q: Queryable, remitoId: string): Promise<void> {
  await q.query(
    `UPDATE tareas SET completada = true, completada_at = now()
     WHERE id = (SELECT tarea_id FROM remitos WHERE id = $1)`,
    [remitoId]
  );
}

// ── Transiciones de estado ───────────────────────────────────────────
// Única implementación de borrador → emitido → entregado | cancelado, compartida por
// PATCH /:id/estado, POST /:id/entregar y POST / con `entrega` (crear y entregar en el lugar).
// Corre dentro de la transacción del llamador; ante un problema tira RemitoError y el
// llamador hace ROLLBACK.

export const TRANSICIONES_REMITO: Record<string, string[]> = {
  borrador:   ['emitido', 'cancelado'],
  emitido:    ['entregado', 'cancelado'],
  entregado:  ['cancelado'],
  cancelado:  [],
};

export class RemitoError extends Error {
  constructor(message: string, public status: 404 | 409 | 422) { super(message); }
}

export interface RemitoParaTransicion {
  id: string;
  numero: string;
  estado: string;
  operacion_id: string | null;
  stock_descontado: boolean;
  tarea_id: string | null;
  items: { producto_id: string | null; cantidad: number }[];
}

export interface DatosEntrega {
  fecha_entrega_real?: string | null;
  firma_url?: string | null;
  recibio_nombre?: string | null;
  recibio_dni?: string | null;
  sin_firma_motivo?: string | null;
}

// `bloquear` toma la fila con FOR UPDATE: dos celulares entregando el mismo remito a la
// vez no pueden descontar stock dos veces.
export async function cargarRemitoParaTransicion(
  q: Queryable, id: string, bloquear = false,
): Promise<RemitoParaTransicion | null> {
  const { rows: [r] } = await q.query(
    `SELECT id, numero, estado, operacion_id, stock_descontado, tarea_id
     FROM remitos WHERE id = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [id]);
  if (!r) return null;
  const { rows: items } = await q.query(
    `SELECT producto_id, cantidad FROM remito_items WHERE remito_id = $1`, [id]);
  return { ...r, items };
}

export async function aplicarTransicionRemito(
  client: Queryable,
  remito: RemitoParaTransicion,
  nuevoEstado: string,
  datos: DatosEntrega,
  userId: string | null,
): Promise<void> {
  const estadoActual = remito.estado;
  if (!TRANSICIONES_REMITO[estadoActual]?.includes(nuevoEstado)) {
    throw new RemitoError(`No se puede pasar de ${estadoActual} a ${nuevoEstado}`, 409);
  }

  // borrador → emitido: cancelar reservas previas + descontar stock
  if (estadoActual === 'borrador' && nuevoEstado === 'emitido' && !remito.stock_descontado) {
    const items = remito.items.filter(i => i.producto_id);

    // Cancelar reservas existentes para esta operación (netear a cero)
    if (remito.operacion_id) {
      const { rows: reservas } = await client.query(`
        SELECT producto_id, SUM(cantidad) AS total
        FROM stock_movimientos
        WHERE operacion_id = $1 AND tipo = 'reserva'
        GROUP BY producto_id
        HAVING SUM(cantidad) < 0
      `, [remito.operacion_id]);

      for (const r of reservas) {
        await client.query(`
          INSERT INTO stock_movimientos
            (producto_id, tipo, cantidad, motivo, operacion_id, referencia_nro, created_by)
          VALUES ($1, 'reserva', $2, 'Cancelación reserva por remito', $3, $4, $5)
        `, [r.producto_id, Math.abs(Number(r.total)), remito.operacion_id, remito.numero, userId]);
      }
    }

    // Bloquear + validar stock disponible (ya neteada la reserva propia cancelada
    // arriba) antes de descontar — evita que dos remitos emitidos en simultáneo
    // sobrevendan el mismo producto. El FOR UPDATE serializa cualquier otra
    // transacción que también bloquee estas mismas filas (incluida venta rápida).
    //
    // El lock y el cálculo de stock van en dos SELECT separados: si van juntos
    // en un solo SELECT ... FOR UPDATE, el re-chequeo de Postgres al
    // desbloquearse (EvalPlanQual) sólo refresca las columnas propias de la fila
    // bloqueada — la subquery contra stock_movimientos sigue viendo el snapshot
    // previo al bloqueo, sin los movimientos recién commiteados por quien tenía
    // el lock. Con dos SELECT, el segundo arranca su propio snapshot ya con el
    // lock en mano.
    const productoIds = [...new Set(items.map(i => i.producto_id as string))];
    if (productoIds.length) {
      await client.query(`
        SELECT id FROM catalogo_productos WHERE id = ANY($1::uuid[]) FOR UPDATE
      `, [productoIds]);
      const { rows: productosLock } = await client.query(`
        SELECT cp.id, cp.nombre,
          (COALESCE(cp.stock_inicial, 0) + COALESCE((
            SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
          ), 0))::int AS stock_actual
        FROM catalogo_productos cp
        WHERE cp.id = ANY($1::uuid[])
      `, [productoIds]);
      const stockPorProducto = new Map(productosLock.map(p => [p.id as string, p]));
      const cantidadPorProducto = new Map<string, number>();
      for (const it of items) {
        const key = it.producto_id as string;
        cantidadPorProducto.set(key, (cantidadPorProducto.get(key) ?? 0) + it.cantidad);
      }
      for (const [prodId, cantidad] of cantidadPorProducto) {
        const prod = stockPorProducto.get(prodId);
        if (!prod || prod.stock_actual < cantidad) {
          throw new RemitoError(
            `Stock insuficiente para "${prod?.nombre ?? prodId}": disponible ${prod?.stock_actual ?? 0}, pedido ${cantidad}`, 422);
        }
      }
    }

    for (const item of items) {
      await client.query(`
        INSERT INTO stock_movimientos
          (producto_id, tipo, cantidad, motivo, referencia_nro, created_by)
        VALUES ($1, 'egreso_remito', $2, 'Remito emitido', $3, $4)
      `, [item.producto_id, -Math.abs(item.cantidad), remito.numero, userId]);
    }
    await client.query(`UPDATE remitos SET stock_descontado=true WHERE id=$1`, [remito.id]);
    remito.stock_descontado = true;

    // Si el stock de algún producto quedó en 0, ya no puede seguir "exhibido en salón"
    if (items.length) {
      await client.query(`
        UPDATE catalogo_productos cp SET en_salon = false
        WHERE cp.id = ANY($1::uuid[]) AND cp.en_salon = true
          AND (COALESCE(cp.stock_inicial,0) + COALESCE((
            SELECT SUM(m.cantidad) FROM stock_movimientos m WHERE m.producto_id = cp.id
          ), 0)) <= 0
      `, [items.map(i => i.producto_id)]);
    }
  }

  // cancelado habiendo ya descontado: revertir stock
  if (nuevoEstado === 'cancelado' && remito.stock_descontado) {
    const items = remito.items.filter(i => i.producto_id);
    for (const item of items) {
      await client.query(`
        INSERT INTO stock_movimientos
          (producto_id, tipo, cantidad, motivo, referencia_nro, created_by)
        VALUES ($1, 'devolucion', $2, 'Cancelación remito', $3, $4)
      `, [item.producto_id, Math.abs(item.cantidad), remito.numero, userId]);
    }
    await client.query(`UPDATE remitos SET stock_descontado=false WHERE id=$1`, [remito.id]);
    remito.stock_descontado = false;
  }

  // Al entregar se registra quién recibió y la hora real; con firma, el motivo de
  // "sin firma" queda vacío.
  const entrega = nuevoEstado === 'entregado';
  await client.query(`
    UPDATE remitos SET
      estado = $1,
      fecha_entrega_real = COALESCE($2::date, CASE WHEN $1='entregado' THEN CURRENT_DATE ELSE fecha_entrega_real END),
      firma_url = COALESCE($4, firma_url),
      recibio_nombre = COALESCE($5, recibio_nombre),
      recibio_dni = COALESCE($6, recibio_dni),
      sin_firma_motivo = CASE WHEN $1='entregado' THEN $7 ELSE sin_firma_motivo END,
      entregado_at = CASE WHEN $1='entregado' THEN now() ELSE entregado_at END,
      updated_at = now()
    WHERE id = $3
  `, [
    nuevoEstado, datos.fecha_entrega_real || null, remito.id, datos.firma_url || null,
    entrega ? datos.recibio_nombre?.trim() || null : null,
    entrega ? datos.recibio_dni || null : null,
    entrega && !datos.firma_url ? datos.sin_firma_motivo?.trim() || null : null,
  ]);
  remito.estado = nuevoEstado;

  // Al entregar: marcar la operación vinculada como entregada
  if (entrega && remito.operacion_id) {
    await client.query(`
      UPDATE operaciones SET estado = 'entregado', updated_at = now()
      WHERE id = $1 AND estado NOT IN ('cancelado', 'entregado')
    `, [remito.operacion_id]);
  }

  // Entregado o cancelado: la tarea espejo de "Entrega programada" se
  // completa (no se borra, queda de historial en la agenda del CRM).
  if ((entrega || nuevoEstado === 'cancelado') && remito.tarea_id) {
    await completarTareaDeEntrega(client, remito.id);
  }
}

// Entrega en el lugar: un borrador se emite (descuenta stock) y se entrega en el mismo paso.
export async function entregarRemito(
  client: Queryable, remito: RemitoParaTransicion, datos: DatosEntrega, userId: string | null,
): Promise<void> {
  if (!['borrador', 'emitido'].includes(remito.estado)) {
    throw new RemitoError(
      remito.estado === 'entregado' ? 'Este remito ya está entregado' : 'Un remito cancelado no se puede entregar', 409);
  }
  if (remito.estado === 'borrador') await aplicarTransicionRemito(client, remito, 'emitido', {}, userId);
  await aplicarTransicionRemito(client, remito, 'entregado', datos, userId);
}

export function detalleEntrega(d: DatosEntrega): string {
  if (!d.firma_url) return `Entregado sin firma: ${d.sin_firma_motivo?.trim() ?? ''}`;
  const quien = [d.recibio_nombre?.trim(), d.recibio_dni ? `DNI ${d.recibio_dni}` : null].filter(Boolean).join(', ');
  return quien ? `Entregado con firma de ${quien}` : 'Entregado con firma';
}
