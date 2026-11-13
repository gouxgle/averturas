// Faltantes de stock al emitir o entregar un remito (server/src/lib/remitos.ts `faltantesDeStock`).
// El servidor responde 422 con `codigo: 'stock_insuficiente'` y la lista; la pantalla ofrece entregar igual.

export interface FaltanteStock {
  producto_id: string;
  nombre: string;
  codigo: string | null;
  disponible: number;
  pedido: number;
}

export function faltantesDeError(e: unknown): FaltanteStock[] | null {
  const datos = (e as { datos?: { codigo?: string; faltantes?: FaltanteStock[] } } | null)?.datos;
  return datos?.codigo === 'stock_insuficiente' && Array.isArray(datos.faltantes) && datos.faltantes.length
    ? datos.faltantes
    : null;
}

export function textoFaltante(f: FaltanteStock): string {
  return `${f.nombre}${f.codigo ? ` (${f.codigo})` : ''}: el sistema tiene ${f.disponible} y salen ${f.pedido}`;
}
