// Carga múltiple de aberturas a medida: se eligen las características UNA vez
// (tipo, sistema, color, vidrio, atributos, instalación, accesorios) y después solo
// se cargan las medidas que cambian. Caso real: 8 ventanas del mismo tipo con 8
// medidas distintas.
//
// Esta lógica vive separada del JSX porque maneja plata (costo/precio por ítem) y
// necesita tests. El precio de un ítem a medida NO se deriva de la medida en este
// sistema — lo da un software externo y se tipea a mano — pero se ofrece un atajo
// de precio por m² para prellenar, que el usuario puede pisar fila por fila.

import type { ItemForm } from '@/pages/NuevoPresupuesto';

export interface FilaMedida {
  _key: string;
  ancho: string;              // metros, como string (igual que ItemForm.medida_ancho)
  alto: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  _precioManual: boolean;     // true = el usuario lo tipeó, el atajo por m² no lo pisa
}

export function nuevaFilaMedida(key: string): FilaMedida {
  return {
    _key: key,
    ancho: '', alto: '',
    cantidad: 1,
    costo_unitario: 0, precio_unitario: 0,
    _precioManual: false,
  };
}

// Acepta coma o punto decimal — en es-AR se tipea "1,20" y el backend hace parseFloat,
// que solo entiende punto.
function aNumero(valor: string): number {
  const n = parseFloat(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizarMedida(valor: string): string {
  const n = aNumero(valor);
  return n > 0 ? String(n) : '';
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Superficie en m² de la fila. 0 si falta ancho o alto (o son inválidos). */
export function superficieFila(f: FilaMedida): number {
  const ancho = aNumero(f.ancho);
  const alto  = aNumero(f.alto);
  if (ancho <= 0 || alto <= 0) return 0;
  return redondear2(ancho * alto);
}

/** Una fila genera ítem solo si tiene ancho Y alto — media fila cargada no cuenta. */
export function filaCompleta(f: FilaMedida): boolean {
  return superficieFila(f) > 0;
}

/**
 * Atajo: prellena costo y precio de cada fila como (precio por m² × m² de la fila).
 * Respeta las filas que el usuario editó a mano (`_precioManual`) y las incompletas.
 */
export function aplicarPrecioPorM2(filas: FilaMedida[], costoM2: number, ventaM2: number): FilaMedida[] {
  return filas.map(f => {
    if (f._precioManual) return f;
    const m2 = superficieFila(f);
    if (m2 <= 0) return f;
    return {
      ...f,
      costo_unitario:  redondear2(costoM2 * m2),
      precio_unitario: redondear2(ventaM2 * m2),
    };
  });
}

/** Total de venta de las filas válidas — misma fórmula que itemPrecioTotal del carrito. */
export function totalFilas(filas: FilaMedida[], precioInstalacion = 0, incluyeInstalacion = false): number {
  return filas.filter(filaCompleta).reduce((acc, f) => {
    const base = f.precio_unitario + (incluyeInstalacion ? precioInstalacion : 0);
    return acc + base * Math.max(1, f.cantidad);
  }, 0);
}

/**
 * Plantilla (características comunes) + filas de medidas → N ítems del carrito.
 * La medida no se agrega a la descripción: ya viaja en medida_ancho/medida_alto y
 * el carrito la muestra en su propia columna.
 */
export function expandirPlantillaAItems(
  plantilla: ItemForm,
  filas: FilaMedida[],
  nuevaKey: () => string,
  descripcionFallback = 'Abertura a medida',
): ItemForm[] {
  // El backend exige descripción no vacía (Zod .min(1)) — sin esto el guardado
  // devuelve 400 y el usuario pierde toda la carga.
  const descripcion = plantilla.descripcion.trim() || descripcionFallback;

  return filas.filter(filaCompleta).map(f => ({
    ...plantilla,
    _key: nuevaKey(),
    tipo_item: 'a_medida' as const,
    producto_id: '',
    servicio_id: '',
    calculo_url: '',          // el respaldo del cálculo es por ítem, se adjunta después
    descripcion,
    medida_ancho: normalizarMedida(f.ancho),
    medida_alto:  normalizarMedida(f.alto),
    cantidad: Math.max(1, Math.round(f.cantidad) || 1),
    costo_unitario:  f.costo_unitario,
    precio_unitario: f.precio_unitario,
    precio_lista: null,
    // Copias propias: sin esto los N ítems comparten el mismo array/objeto y editar
    // uno muta a todos.
    accesorios: [...plantilla.accesorios],
    _atribAbrev: { ...plantilla._atribAbrev },
  }));
}
