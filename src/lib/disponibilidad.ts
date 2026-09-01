// ¿Cuándo puedo entregar este producto? — se calcula con datos que ya existen, sin
// prometer nada que el sistema no pueda sostener.
//
// IMPORTANTE, y es el punto que más importa del módulo: `plazo_entrega_dias` es del
// PROVEEDOR, no del producto. Dos productos del mismo proveedor van a mostrar siempre
// el mismo número, y ese número es lo que el proveedor declaró en general — no una
// confirmación para este producto puntual. Por eso el vocabulario es "estimado",
// "≈", "declarado", "a confirmar", y nunca una fecha de calendario: "llega el DD/MM"
// está reservado a `pedidos.fecha_entrega_est`, que sí es un compromiso real.

import type { Producto } from '@/types';
import { diasCalendarioAR, disponibilidadVigente } from '@/lib/utils';

export type EstadoDisponibilidad = 'inmediata' | 'confirmada' | 'estimada' | 'desconocida';

export interface Disponibilidad {
  estado: EstadoDisponibilidad;
  /** Días estimados: 0 si hay stock, el plazo declarado del proveedor, o null. */
  dias: number | null;
  label: string;
  /** Tooltip — de dónde sale el dato y qué NO es. */
  detalle: string;
  /** Para ordenar por "entrega más rápida". Sin dato ⇒ nunca primero. */
  rank: number;
}

const SIN_DATO = Number.MAX_SAFE_INTEGER;

export function disponibilidadProducto(p: Producto): Disponibilidad {
  const stock = p.stock_actual ?? 0;
  const plazo = p.proveedor?.plazo_entrega_dias ?? null;
  const prov  = p.proveedor?.nombre ?? 'el proveedor';

  if (stock >= 1) {
    return {
      estado: 'inmediata', dias: 0, rank: 0,
      label: 'Entrega inmediata',
      detalle: `Hay ${stock} en stock — se entrega sin esperar al proveedor.`,
    };
  }

  if (disponibilidadVigente(p.disponibilidad_confirmada_at)) {
    const hace = diasCalendarioAR(p.disponibilidad_confirmada_at!);
    return {
      estado: 'confirmada', dias: plazo, rank: plazo ?? 1,
      label: hace <= 0 ? 'Disponible — confirmado hoy' : `Disponible — confirmado hace ${hace} d`,
      detalle: `Disponibilidad confirmada con ${prov}${plazo != null ? `, plazo declarado ≈${plazo} días` : ''}.`,
    };
  }

  if (plazo != null) {
    return {
      estado: 'estimada', dias: plazo, rank: plazo,
      label: `≈ ${plazo} días`,
      detalle: `Plazo declarado por ${prov} — estimado general del proveedor, no confirmado para este producto.`,
    };
  }

  return {
    estado: 'desconocida', dias: null, rank: SIN_DATO,
    label: 'Plazo a confirmar',
    detalle: `Sin stock y sin plazo cargado para ${prov}. Chequealo antes de comprometer una fecha.`,
  };
}

/** true si ningún producto del set tiene plazo declarado — dispara el aviso de "cargalo en Proveedores". */
export function ningunProveedorConPlazo(items: Producto[]): boolean {
  return !items.some(p => p.proveedor?.plazo_entrega_dias != null);
}
