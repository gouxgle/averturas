import type { LucideIcon } from 'lucide-react';

/**
 * Tipos compartidos por todos los manuales del sistema.
 *
 * Cada manual es un archivo `manualX.ts` con un array de secciones; el registro de
 * `manuales.ts` los junta. El contenido lo renderean la página `/ayuda/:manual` y la
 * versión imprimible `/imprimir/manual/:manual`, las dos con `ContenidoManual.tsx`.
 *
 * Están escritos para el operador del local, no para desarrolladores: si se cambia una
 * pantalla, hay que corregir el manual (y el resumen corto del panel de Ayuda, en
 * `HelpDrawer.tsx`).
 *
 * En los textos, `**esto**` sale en negrita.
 */
export type Bloque =
  | { t: 'p'; texto: string }
  | { t: 'lista'; items: string[]; ordenada?: boolean }
  | { t: 'tabla'; cols: string[]; filas: string[][] }
  /** Recuadro destacado: `regla` es una regla del negocio, `ojo` una advertencia. */
  | { t: 'aviso'; tono: 'info' | 'ojo' | 'regla'; texto: string }
  | { t: 'flujo'; nodos: string[] }
  | { t: 'subtitulo'; texto: string };

export interface SeccionManual {
  id: string;
  titulo: string;
  /** Rótulo corto para el índice lateral. */
  corto: string;
  icono: LucideIcon;
  bloques: Bloque[];
}

/** Texto plano de una sección — lo usa el buscador de la página. */
export function textoDeSeccion(s: SeccionManual): string {
  const partes: string[] = [s.titulo];
  for (const b of s.bloques) {
    if (b.t === 'p' || b.t === 'subtitulo' || b.t === 'aviso') partes.push(b.texto);
    else if (b.t === 'lista') partes.push(...b.items);
    else if (b.t === 'tabla') { partes.push(...b.cols); b.filas.forEach(f => partes.push(...f)); }
    else if (b.t === 'flujo') partes.push(...b.nodos);
  }
  return partes.join(' ').toLowerCase();
}
