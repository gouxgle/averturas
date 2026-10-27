// Buzón de comentarios: lo comparten el globito flotante (aviso rápido) y la página /comentarios.
export interface Comentario {
  id: string;
  texto: string;
  resuelto: boolean;
  resuelto_at: string | null;
  archivado: boolean;
  archivado_at: string | null;
  created_at: string;
  created_by_nombre: string | null;
  resuelto_by_nombre: string | null;
}

// Cualquier cambio desde uno avisa al otro para que recargue (el contador del globito, la lista de la página).
export const EVENTO_COMENTARIOS = 'comentarios:cambiaron';
export const avisarCambioComentarios = () => window.dispatchEvent(new Event(EVENTO_COMENTARIOS));

export function fmtFechaComentario(iso: string, conAno = false) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', ...(conAno ? { year: 'numeric' } : {}), hour: '2-digit', minute: '2-digit',
  });
}
