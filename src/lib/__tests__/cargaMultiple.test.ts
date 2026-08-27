import { describe, it, expect } from 'vitest';
import {
  nuevaFilaMedida, superficieFila, filaCompleta,
  aplicarPrecioPorM2, totalFilas, expandirPlantillaAItems,
  type FilaMedida,
} from '@/lib/cargaMultiple';
import type { ItemForm } from '@/pages/NuevoPresupuesto';

// Plantilla mínima equivalente a lo que produce emptyItem() + specs cargadas una vez
function plantillaBase(over: Partial<ItemForm> = {}): ItemForm {
  return {
    _key: 'plantilla',
    producto_id: '', tipo_item: 'a_medida', servicio_id: '',
    tipo_abertura_id: 'tipo-1', sistema_id: 'sist-1',
    descripcion: 'Ventana aluminio blanco 3+3',
    medida_ancho: '', medida_alto: '',
    cantidad: 1,
    costo_unitario: 0, precio_unitario: 0, precio_lista: null,
    incluye_instalacion: false, costo_instalacion: 0, precio_instalacion: 0,
    vidrio: '3+3', premarco: false, origen: 'proveedor', color: 'Blanco',
    accesorios: ['Herrajes completos'],
    calculo_url: '', _atribAbrev: { tipo_ventana: 'corrediza' },
    _prod_ancho: null, _prod_alto: null, _prod_atributos: {}, _prod_stock: 0,
    _prod_tipo_nombre: '', _prod_sistema_nombre: '',
    _prod_imagen_url: null, _prod_disponibilidad_confirmada_at: null,
    ...over,
  };
}

function fila(over: Partial<FilaMedida> = {}): FilaMedida {
  return { ...nuevaFilaMedida('f'), ...over };
}

// Contador determinístico para los _key generados
function keyGen() {
  let n = 0;
  return () => `k${++n}`;
}

describe('superficieFila', () => {
  it('multiplica ancho por alto', () => {
    expect(superficieFila(fila({ ancho: '1.20', alto: '2.05' }))).toBe(2.46);
  });

  it('acepta coma decimal (formato es-AR)', () => {
    expect(superficieFila(fila({ ancho: '1,20', alto: '2,05' }))).toBe(2.46);
  });

  it('da 0 si falta el alto', () => {
    expect(superficieFila(fila({ ancho: '1.20', alto: '' }))).toBe(0);
  });

  it('da 0 con valores no numéricos', () => {
    expect(superficieFila(fila({ ancho: 'abc', alto: '2' }))).toBe(0);
  });

  it('da 0 con medidas negativas o cero', () => {
    expect(superficieFila(fila({ ancho: '-1', alto: '2' }))).toBe(0);
    expect(superficieFila(fila({ ancho: '0', alto: '2' }))).toBe(0);
  });
});

describe('filaCompleta', () => {
  it('es true solo con ancho y alto válidos', () => {
    expect(filaCompleta(fila({ ancho: '1', alto: '1' }))).toBe(true);
    expect(filaCompleta(fila({ ancho: '1', alto: '' }))).toBe(false);
    expect(filaCompleta(fila())).toBe(false);
  });
});

describe('aplicarPrecioPorM2', () => {
  it('calcula costo y venta como precio/m² × m²', () => {
    const filas = [fila({ _key: 'a', ancho: '2', alto: '1' })];
    const [r] = aplicarPrecioPorM2(filas, 10000, 20000);
    expect(r.costo_unitario).toBe(20000);   // 2 m² × 10.000
    expect(r.precio_unitario).toBe(40000);  // 2 m² × 20.000
  });

  it('NO pisa las filas editadas a mano', () => {
    const filas = [
      fila({ _key: 'a', ancho: '2', alto: '1' }),
      fila({ _key: 'b', ancho: '2', alto: '1', costo_unitario: 999, precio_unitario: 1234, _precioManual: true }),
    ];
    const [auto, manual] = aplicarPrecioPorM2(filas, 10000, 20000);
    expect(auto.precio_unitario).toBe(40000);
    expect(manual.costo_unitario).toBe(999);
    expect(manual.precio_unitario).toBe(1234);
  });

  it('deja intactas las filas incompletas', () => {
    const filas = [fila({ _key: 'a', ancho: '1.20', alto: '' })];
    const [r] = aplicarPrecioPorM2(filas, 10000, 20000);
    expect(r.costo_unitario).toBe(0);
    expect(r.precio_unitario).toBe(0);
  });

  it('no muta el array original', () => {
    const filas = [fila({ _key: 'a', ancho: '2', alto: '1' })];
    aplicarPrecioPorM2(filas, 10000, 20000);
    expect(filas[0].precio_unitario).toBe(0);
  });
});

describe('totalFilas', () => {
  it('suma precio × cantidad de las filas válidas', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1', alto: '1', precio_unitario: 100, cantidad: 2 }),
      fila({ _key: 'b', ancho: '1', alto: '1', precio_unitario: 50,  cantidad: 1 }),
    ];
    expect(totalFilas(filas)).toBe(250);
  });

  it('ignora las filas sin medida', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1', alto: '1', precio_unitario: 100 }),
      fila({ _key: 'b', ancho: '', alto: '', precio_unitario: 9999 }),
    ];
    expect(totalFilas(filas)).toBe(100);
  });

  it('suma la instalación por unidad cuando está incluida', () => {
    const filas = [fila({ _key: 'a', ancho: '1', alto: '1', precio_unitario: 100, cantidad: 2 })];
    // (100 + 30) × 2
    expect(totalFilas(filas, 30, true)).toBe(260);
  });
});

describe('expandirPlantillaAItems', () => {
  it('genera un ítem por cada fila completa', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1.20', alto: '2.05', precio_unitario: 145000 }),
      fila({ _key: 'b', ancho: '1.50', alto: '1.10', precio_unitario: 105000 }),
      fila({ _key: 'c', ancho: '0.80', alto: '1.10', precio_unitario: 68000 }),
    ];
    const items = expandirPlantillaAItems(plantillaBase(), filas, keyGen());
    expect(items).toHaveLength(3);
    expect(items.map(i => i.medida_ancho)).toEqual(['1.2', '1.5', '0.8']);
    expect(items.map(i => i.precio_unitario)).toEqual([145000, 105000, 68000]);
  });

  it('descarta las filas a medio cargar', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1.20', alto: '2.05' }),
      fila({ _key: 'b', ancho: '1.50', alto: '' }),   // sin alto
      fila({ _key: 'c' }),                             // vacía
    ];
    expect(expandirPlantillaAItems(plantillaBase(), filas, keyGen())).toHaveLength(1);
  });

  it('copia las características comunes a todos los ítems', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1', alto: '1' }),
      fila({ _key: 'b', ancho: '2', alto: '2' }),
    ];
    const items = expandirPlantillaAItems(plantillaBase(), filas, keyGen());
    for (const it of items) {
      expect(it.tipo_abertura_id).toBe('tipo-1');
      expect(it.sistema_id).toBe('sist-1');
      expect(it.color).toBe('Blanco');
      expect(it.vidrio).toBe('3+3');
      expect(it.descripcion).toBe('Ventana aluminio blanco 3+3');
      expect(it.tipo_item).toBe('a_medida');
    }
  });

  it('da a cada ítem su propia copia de accesorios y atributos', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1', alto: '1' }),
      fila({ _key: 'b', ancho: '2', alto: '2' }),
    ];
    const [i1, i2] = expandirPlantillaAItems(plantillaBase(), filas, keyGen());
    i1.accesorios.push('Sellado');
    i1._atribAbrev.linea = 'modena';
    // Sin copia propia, mutar uno mutaría a todos
    expect(i2.accesorios).toEqual(['Herrajes completos']);
    expect(i2._atribAbrev).toEqual({ tipo_ventana: 'corrediza' });
  });

  it('asigna un _key distinto a cada ítem', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1', alto: '1' }),
      fila({ _key: 'b', ancho: '2', alto: '2' }),
    ];
    const items = expandirPlantillaAItems(plantillaBase(), filas, keyGen());
    expect(new Set(items.map(i => i._key)).size).toBe(2);
  });

  it('nunca deja la descripción vacía (el backend la exige)', () => {
    const filas = [fila({ _key: 'a', ancho: '1', alto: '1' })];
    const items = expandirPlantillaAItems(
      plantillaBase({ descripcion: '   ' }), filas, keyGen(), 'Ventana Módena',
    );
    expect(items[0].descripcion).toBe('Ventana Módena');
  });

  it('normaliza la coma decimal a punto para el backend', () => {
    const filas = [fila({ _key: 'a', ancho: '1,20', alto: '2,05' })];
    const [it] = expandirPlantillaAItems(plantillaBase(), filas, keyGen());
    // parseFloat del payload solo entiende punto
    expect(parseFloat(it.medida_ancho)).toBe(1.2);
    expect(parseFloat(it.medida_alto)).toBe(2.05);
  });

  it('limpia lo que no debe heredarse de la plantilla', () => {
    const filas = [fila({ _key: 'a', ancho: '1', alto: '1' })];
    const [it] = expandirPlantillaAItems(
      plantillaBase({ calculo_url: '/uploads/viejo.webp', producto_id: 'prod-1' }),
      filas, keyGen(),
    );
    expect(it.calculo_url).toBe('');
    expect(it.producto_id).toBe('');
    expect(it.precio_lista).toBeNull();
  });

  it('fuerza cantidad mínima de 1', () => {
    const filas = [fila({ _key: 'a', ancho: '1', alto: '1', cantidad: 0 })];
    const [it] = expandirPlantillaAItems(plantillaBase(), filas, keyGen());
    expect(it.cantidad).toBe(1);
  });

  it('el total de los ítems generados coincide con el total mostrado en el modal', () => {
    const filas = [
      fila({ _key: 'a', ancho: '1.20', alto: '2.05', precio_unitario: 145000, cantidad: 1 }),
      fila({ _key: 'b', ancho: '0.80', alto: '1.10', precio_unitario: 68000,  cantidad: 2 }),
    ];
    const plantilla = plantillaBase({ incluye_instalacion: true, precio_instalacion: 5000 });
    const items = expandirPlantillaAItems(plantilla, filas, keyGen());

    // Misma fórmula que itemPrecioTotal() en NuevoPresupuesto.tsx
    const totalCarrito = items.reduce((s, it) => {
      const base = it.precio_unitario + (it.incluye_instalacion ? it.precio_instalacion : 0);
      return s + base * it.cantidad;
    }, 0);

    expect(totalCarrito).toBe(totalFilas(filas, 5000, true));
    expect(totalCarrito).toBe(150000 + 146000);
  });
});
