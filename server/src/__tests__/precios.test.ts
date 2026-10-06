import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analizarProducto, redondearPrecio, precioSegunCriterio, type DatosAnalisis,
  precioPorFormula, redondearTerminacion, elegirFormula, posibleErrorCarga, type Formula } from '../lib/precios.js';

// Revisión integral de precios: análisis/sugerencia (puro) y endpoints contra la base local.
//   DATABASE_URL=… npx vitest run precios

const cfg = { umbral_pct: 3, dias_al_dia: 7, dias_vencido: 10 };
const base: DatosAnalisis = {
  costo: 100_000, precio: 130_000, recargo_objetivo: null, costo_lista: null, costo_compra: null,
  compra_posterior: false, dolar_al_actualizar: 1500, dolar_hoy: 1500, dias: 20, ipc_pct: 1,
};

const FORMULA: Formula = {
  id: 'g', nombre: 'Estándar', divisor: 0.6, recargo_pct: 15, adicional_costo_pct: 12, redondeo_paso: 1000, redondeo_terminacion: 900,
  tipo_abertura_id: null, proveedor_id: null, activa: true,
};

describe('fórmula de precio (productos estándar)', () => {
  it('el ejemplo del negocio: costo 100.000 → 203.900, con los pasos', () => {
    const r = precioPorFormula(100_000, FORMULA);
    expect(r.precio).toBe(203_900);
    expect(r.pasos.map(p => p.valor)).toEqual([12_000, 166_666.67, 191_666.67, 203_666.67, 203_900]);
  });
  it('redondeo terminado en 900: hacia arriba, y si ya termina en 900 queda igual', () => {
    expect(redondearTerminacion(203_666.67, 1000, 900)).toBe(203_900);
    expect(redondearTerminacion(203_900, 1000, 900)).toBe(203_900);
    expect(redondearTerminacion(203_950, 1000, 900)).toBe(204_900);
    expect(redondearTerminacion(250, 1000, 900)).toBe(900);
    expect(redondearTerminacion(1234.5, 0, 0)).toBe(1234.5);
    expect(redondearPrecio(203_901, 1000, 900)).toBe(204_900);
  });
  it('costos con centavos', () => {
    expect(precioPorFormula(146_400.5, FORMULA).precio).toBe(298_900);   // 298.169,35
  });
  it('gana la fórmula más específica y solo para estándar', () => {
    const fam = { ...FORMULA, id: 'f', tipo_abertura_id: 'puertas' };
    const prov = { ...FORMULA, id: 'p', proveedor_id: 'acme' };
    const ambos = { ...FORMULA, id: 'fp', tipo_abertura_id: 'puertas', proveedor_id: 'acme' };
    const fs = [FORMULA, fam, prov, ambos];
    expect(elegirFormula(fs, { tipo: 'estandar', tipo_abertura_id: 'puertas', proveedor_id: 'acme' })?.id).toBe('fp');
    expect(elegirFormula(fs, { tipo: 'estandar', tipo_abertura_id: 'puertas', proveedor_id: 'otro' })?.id).toBe('f');
    expect(elegirFormula(fs, { tipo: 'estandar', tipo_abertura_id: 'ventanas', proveedor_id: 'acme' })?.id).toBe('p');
    expect(elegirFormula(fs, { tipo: 'estandar', tipo_abertura_id: null, proveedor_id: null })?.id).toBe('g');
    expect(elegirFormula(fs, { tipo: 'a_medida_proveedor', tipo_abertura_id: null, proveedor_id: null })).toBeNull();
    expect(elegirFormula([{ ...fam, activa: false }, FORMULA], { tipo: 'estandar', tipo_abertura_id: 'puertas', proveedor_id: null })?.id).toBe('g');
  });
  it('posible error de carga', () => {
    expect(posibleErrorCarga(175.8, 354_600)).toBe(true);     // costo en miles
    expect(posibleErrorCarga(1, 1)).toBe(true);               // portón a $1
    expect(posibleErrorCarga(100_000, 105_000)).toBe(true);   // precio casi igual al costo
    expect(posibleErrorCarga(100_000, 380_000)).toBe(false);  // caro, pero posible
  });
  it('en el análisis: debajo → actualizar a la fórmula; encima → aviso sin bajar', () => {
    const debajo = analizarProducto({ ...base, precio: 191_700, formula: FORMULA }, cfg);
    expect(debajo.precio_por_formula).toBe(203_900);
    expect(debajo.estado).toBe('actualizar');
    expect(debajo.precio_sugerido).toBe(203_900);
    expect(debajo.motivos.some(m => m.tipo === 'formula')).toBe(true);
    const encima = analizarProducto({ ...base, precio: 380_000, formula: FORMULA }, cfg);
    expect(encima.precio_sugerido).toBe(380_000);
    expect(encima.motivos.some(m => /encima de la fórmula/.test(m.texto))).toBe(true);
    const enFormula = analizarProducto({ ...base, precio: 201_700, formula: FORMULA }, cfg);   // 2,0167 (con 10 %): −1,1 %
    expect(enFormula.estado).toBe('renovar');
    const error = analizarProducto({ ...base, costo: 175.8, precio: 354_600, formula: FORMULA }, cfg);
    expect(error.posible_error_carga).toBe(true);
    expect(error.motivos.some(m => m.tipo === 'formula')).toBe(false);
  });
  it('criterio "fórmula": costo cargado o de reposición, y nada cambia sin fórmula o con error de carga', () => {
    const a = analizarProducto({ ...base, precio: 150_000, costo_lista: 110_000, formula: FORMULA }, cfg);
    expect(precioSegunCriterio(150_000, a, { tipo: 'formula', base: 'cargado', actualizar_costo: false }, null, { costo: 100_000, formula: FORMULA }))
      .toEqual({ precio: 203_900, costo: null });
    expect(precioSegunCriterio(150_000, a, { tipo: 'formula', base: 'reposicion', actualizar_costo: true }, null, { costo: 100_000, formula: FORMULA }))
      .toEqual({ precio: precioPorFormula(110_000, FORMULA).precio, costo: 110_000 });
    expect(precioSegunCriterio(150_000, a, { tipo: 'formula', base: 'cargado', actualizar_costo: false }, null, { costo: 100_000, formula: null }).precio).toBe(150_000);
    const err = analizarProducto({ ...base, costo: 1, precio: 1, formula: FORMULA }, cfg);
    expect(precioSegunCriterio(1, err, { tipo: 'formula', base: 'cargado', actualizar_costo: false }, null, { costo: 1, formula: FORMULA }).precio).toBe(1);
  });
});

describe('análisis y sugerencia de precio', () => {
  it('nada cambió → renovar validez (sin tocar el precio)', () => {
    const a = analizarProducto(base, cfg);
    expect(a.estado).toBe('renovar');
    expect(a.precio_sugerido).toBe(130_000);
    expect(a.motivos).toEqual([]);
  });

  it('recién actualizado y sin cambios → al día', () => {
    expect(analizarProducto({ ...base, dias: 3 }, cfg).estado).toBe('al_dia');
  });

  it('la lista del proveedor subió: mantiene el recargo sobre el costo nuevo', () => {
    const a = analizarProducto({ ...base, costo_lista: 112_000 }, cfg);
    expect(a.estado).toBe('actualizar');
    expect(a.costo_reposicion).toBe(112_000);
    expect(a.precio_sugerido).toBe(145_600);       // 112.000 × 1,30
    expect(a.pct_sugerido).toBe(12);
    expect(a.motivos.map(m => m.tipo)).toContain('lista');
  });

  it('el dólar subió más del umbral: sugiere por dólar', () => {
    const a = analizarProducto({ ...base, dolar_hoy: 1620 }, cfg);
    expect(a.var_dolar).toBe(8);
    expect(a.precio_sugerido).toBe(140_400);
    expect(a.estado).toBe('actualizar');
  });

  it('costo y dólar subieron: toma el mayor, no los suma', () => {
    const a = analizarProducto({ ...base, costo_lista: 105_000, dolar_hoy: 1620 }, cfg);
    expect(a.precio_sugerido).toBe(140_400);       // dólar +8 % > costo +5 %
  });

  it('si ya gana más que el objetivo, conserva su recargo (no baja el precio cuando sube el costo)', () => {
    const a = analizarProducto({ ...base, recargo_objetivo: 20, costo_lista: 110_000 }, cfg);
    expect(a.precio_sugerido).toBe(143_000);       // 130.000 × 1,10 (recargo 30 % > objetivo 20 %)
    expect(a.motivos.some(m => m.tipo === 'recargo')).toBe(false);
  });

  it('manteniendo el recargo no aparecen centavos de redondeo', () => {
    const a = analizarProducto({ ...base, costo: 53_000, precio: 107_700 }, cfg);
    expect(a.precio_por_costo).toBe(107_700);
  });

  it('recargo por debajo del objetivo', () => {
    const a = analizarProducto({ ...base, recargo_objetivo: 40 }, cfg);
    expect(a.precio_sugerido).toBe(140_000);
    expect(a.motivos.find(m => m.tipo === 'recargo')?.texto).toMatch(/objetivo 40/);
  });

  it('una compra absurda no mueve la sugerencia y avisa', () => {
    const a = analizarProducto({ ...base, costo_compra: 5_000, compra_posterior: true }, cfg);
    expect(a.estado).toBe('renovar');
    expect(a.motivos[0].texto).toMatch(/difiere mucho/);
  });

  it('la compra solo cuenta si es posterior a la última actualización', () => {
    expect(analizarProducto({ ...base, costo_compra: 110_000, compra_posterior: false }, cfg).estado).toBe('renovar');
    expect(analizarProducto({ ...base, costo_compra: 110_000, compra_posterior: true }, cfg).estado).toBe('actualizar');
  });

  it('el proveedor bajó: no sugiere bajar solo, pero avisa', () => {
    const a = analizarProducto({ ...base, costo_lista: 90_000 }, cfg);
    expect(a.estado).toBe('renovar');
    expect(a.motivos.some(m => /bajó/.test(m.texto))).toBe(true);
  });

  it('sin costo → sin datos', () => {
    expect(analizarProducto({ ...base, costo: 0 }, cfg).estado).toBe('sin_datos');
  });

  it('variaciones por debajo del umbral no se proponen', () => {
    expect(analizarProducto({ ...base, costo_lista: 102_000, dolar_hoy: 1530 }, cfg).estado).toBe('renovar');
  });
});

describe('criterios y redondeo', () => {
  const a = analizarProducto({ ...base, costo_lista: 112_000, dolar_hoy: 1620 }, cfg);
  it('redondeo hacia arriba al paso elegido', () => {
    expect(redondearPrecio(145_601, 100)).toBe(145_700);
    expect(redondearPrecio(145_600, 100)).toBe(145_600);
    expect(redondearPrecio(145_600.4, 0)).toBe(145_600.4);
    expect(redondearPrecio(1234.5, 1000)).toBe(2000);
  });
  it('cada criterio', () => {
    expect(precioSegunCriterio(130_000, a, { tipo: 'porcentaje', pct: 10 }, null).precio).toBeCloseTo(143_000);
    expect(precioSegunCriterio(130_000, a, { tipo: 'dolar' }, null).precio).toBe(140_400);
    expect(precioSegunCriterio(130_000, a, { tipo: 'costo', actualizar_costo: true }, null)).toEqual({ precio: 145_600, costo: 112_000 });
    expect(precioSegunCriterio(130_000, a, { tipo: 'grupos', por: 'familia', pcts: { f1: 5 } }, 'f1').precio).toBeCloseTo(136_500);
    expect(precioSegunCriterio(130_000, a, { tipo: 'grupos', por: 'familia', pcts: { f1: 5 } }, 'f2').precio).toBe(130_000);
  });
});

const MARCA = '__test_precios__';

describe.skipIf(!process.env.DATABASE_URL)('revisión de precios contra la base', () => {
  type Db = typeof import('../db.js')['db'];
  let db: Db;
  let app: import('hono').Hono;
  let provA: string, provB: string, pA1: string, pA2: string, pA3: string, pB1: string;
  const req = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const prod = async (nombre: string, prov: string, costo: number, precio: number, extra = '') => {
    const { rows: [p] } = await db.query(
      `INSERT INTO catalogo_productos (nombre, tipo, costo_base, precio_base, proveedor_id, precio_actualizado_at ${extra ? ', proveedor_sku' : ''})
       VALUES ($1, 'estandar', $2, $3, $4, now() - interval '20 days' ${extra ? ', $5' : ''}) RETURNING id`,
      extra ? [`${MARCA} ${nombre}`, costo, precio, prov, extra] : [`${MARCA} ${nombre}`, costo, precio, prov]);
    return p.id as string;
  };
  const fila = async (id: string) => (await db.query(
    `SELECT costo_base::float AS costo, precio_base::float AS precio, (now() - precio_actualizado_at) < interval '1 minute' AS renovado
       FROM catalogo_productos WHERE id = $1`, [id])).rows[0];

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const { Hono } = await import('hono');
    app = new Hono();
    app.use('*', async (c, next) => { (c as unknown as { set: (k: string, v: unknown) => void }).set('user', { id: null, rol: 'admin' }); await next(); });
    app.route('/productos', (await import('../routes/productos.js')).default);
    app.route('/catalogo', (await import('../routes/catalogo.js')).default);
    ({ rows: [{ id: provA }] } = await db.query(`INSERT INTO proveedores (nombre) VALUES ('${MARCA} A') RETURNING id`));
    ({ rows: [{ id: provB }] } = await db.query(`INSERT INTO proveedores (nombre) VALUES ('${MARCA} B') RETURNING id`));
    pA1 = await prod('A1', provA, 100_000, 130_000, 'SKU-1');
    pA2 = await prod('A2', provA, 50_000, 70_000, 'SKU-2');
    pA3 = await prod('A3', provA, 20_000, 30_000, 'SKU-3');
    pB1 = await prod('B1', provB, 10_000, 15_000, 'SKU-1');   // mismo SKU, otro proveedor
  });

  afterAll(async () => {
    await db.query(`DELETE FROM proveedor_precios WHERE proveedor_id = ANY($1)`, [[provA, provB]]);
    await db.query(`DELETE FROM catalogo_productos WHERE nombre LIKE $1`, [`${MARCA}%`]);
    await db.query(`DELETE FROM proveedores WHERE id = ANY($1)`, [[provA, provB]]);
  });

  it('el análisis trae cada producto con su estado', async () => {
    const r = await req('GET', '/productos/revision-precios');
    expect(r.status).toBe(200);
    const a1 = r.json.productos.find((p: { id: string }) => p.id === pA1);
    expect(a1).toMatchObject({ costo: 100_000, precio: 130_000, proveedor: `${MARCA} A` });
    expect(['renovar', 'actualizar']).toContain(a1.analisis.estado);
    expect(r.json.config.umbral_pct).toBeGreaterThan(0);
  });

  it('fórmulas: la excepción del proveedor gana, la vista previa usa la fórmula y la general no se borra', async () => {
    const exc = await req('POST', '/productos/revision-precios/formulas', {
      nombre: `${MARCA} exc`, divisor: 0.5, recargo_pct: 0, adicional_costo_pct: 0, redondeo_paso: 0, redondeo_terminacion: 0, proveedor_id: provB,
    });
    expect(exc.status).toBe(201);
    try {
      const r = await req('GET', '/productos/revision-precios');
      const general = r.json.formulas.find((f: Formula) => !f.tipo_abertura_id && !f.proveedor_id);
      const porId = (id: string) => r.json.productos.find((p: { id: string }) => p.id === id);
      expect(porId(pA1).formula_id).toBe(general.id);
      expect(porId(pB1).formula_id).toBe(exc.json.id);
      expect(porId(pB1).analisis.precio_por_formula).toBe(20_000);   // 10.000 ÷ 0,5

      const prev = await req('POST', '/productos/revision-precios/previsualizar', {
        ids: [pA1, pB1], criterio: { tipo: 'formula', base: 'cargado', actualizar_costo: false },
      });
      expect(prev.status).toBe(200);
      const it = Object.fromEntries(prev.json.items.map((i: { id: string; precio_nuevo: number }) => [i.id, i.precio_nuevo]));
      expect(it[pB1]).toBe(20_000);
      expect(it[pA1]).toBe(precioPorFormula(100_000, general).precio);

      expect((await req('DELETE', `/productos/revision-precios/formulas/${general.id}`)).status).toBe(409);
      expect((await req('POST', '/productos/revision-precios/formulas', { ...general, id: undefined, tipo_abertura_id: null, proveedor_id: null })).status).toBe(422);
    } finally {
      expect((await req('DELETE', `/productos/revision-precios/formulas/${exc.json.id}`)).status).toBe(200);
    }
  });

  it('lista de un proveedor: solo analiza sus productos, avisa SKUs sin enlazar y faltantes', async () => {
    const filas = [
      { sku: 'SKU-1', descripcion: 'Ventana', precio: 110_000 },   // +10 %
      { sku: 'sku-2', descripcion: 'Puerta', precio: 50_000 },     // igual (SKU en minúscula)
      { sku: 'SKU-99', descripcion: 'Nuevo', precio: 1_000 },      // no está en el catálogo
    ];
    const r = await req('POST', '/catalogo/proveedor-precios/analizar-lista', { proveedor_id: provA, filas });
    expect(r.status).toBe(200);
    const porId = Object.fromEntries(r.json.coincidencias.map((c: { producto_id: string }) => [c.producto_id, c]));
    expect(Object.keys(porId).sort()).toEqual([pA1, pA2].sort());     // nunca el producto del proveedor B
    expect(porId[pA1]).toMatchObject({ estado: 'sube', costo_nuevo: 110_000, precio_nuevo: 143_000 });
    expect(porId[pA2].estado).toBe('igual');
    expect(r.json.sin_enlazar.map((s: { sku: string }) => s.sku)).toEqual(['SKU-99']);
    expect(r.json.faltantes.map((f: { producto_id: string }) => f.producto_id)).toEqual([pA3]);

    const ap = await req('POST', '/catalogo/proveedor-precios/aplicar-lista', {
      proveedor_id: provA, filas, detalle: 'Lista de prueba',
      items: [
        { producto_id: pA1, costo_nuevo: 110_000, precio_nuevo: 143_000, solo_renovar: false },
        { producto_id: pA2, costo_nuevo: 50_000, precio_nuevo: null, solo_renovar: true },
        { producto_id: pB1, costo_nuevo: 1, precio_nuevo: 1, solo_renovar: false },   // de otro proveedor: se ignora
      ],
    });
    expect(ap.json).toMatchObject({ actualizados: 1, renovados: 1, ignorados: 1, lista: 3 });
    expect(await fila(pA1)).toEqual({ costo: 110_000, precio: 143_000, renovado: true });
    expect(await fila(pA2)).toEqual({ costo: 50_000, precio: 70_000, renovado: true });
    expect(await fila(pB1)).toMatchObject({ costo: 10_000, precio: 15_000, renovado: false });
    const { rows: hist } = await db.query(`SELECT tipo, origen, detalle FROM producto_precio_historial WHERE producto_id = $1`, [pA1]);
    expect(hist).toEqual([{ tipo: 'cambio_precio', origen: 'lista_proveedor', detalle: 'Lista de prueba' }]);
  });

  it('actualizar precios: vista previa con redondeo y aplicar con historial', async () => {
    const prev = await req('POST', '/productos/revision-precios/previsualizar', {
      ids: [pA3], criterio: { tipo: 'porcentaje', pct: 7 }, redondeo: 100 });
    expect(prev.json.items[0]).toMatchObject({ precio_actual: 30_000, precio_nuevo: 32_100 });
    const ap = await req('POST', '/productos/revision-precios/aplicar', { items: [{ id: pA3, precio_nuevo: 32_100 }], criterio: 'porcentaje 7 %' });
    expect(ap.json.actualizados).toBe(1);
    expect(await fila(pA3)).toEqual({ costo: 20_000, precio: 32_100, renovado: true });
    const h = await req('GET', `/productos/${pA3}/historial-precios`);
    expect(h.json[0]).toMatchObject({ tipo: 'cambio_precio', criterio: 'porcentaje 7 %', origen: 'revision' });
  });

  it('renovar validez deja historial sin cambiar el precio', async () => {
    const r = await req('PATCH', '/productos/renovar-validez-precios', { producto_ids: [pB1] });
    expect(r.json.actualizados).toBe(1);
    expect(await fila(pB1)).toEqual({ costo: 10_000, precio: 15_000, renovado: true });
    const { rows } = await db.query(`SELECT tipo FROM producto_precio_historial WHERE producto_id = $1`, [pB1]);
    expect(rows).toEqual([{ tipo: 'renovacion' }]);
  });
});
