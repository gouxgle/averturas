// Lleva la pantalla arriba de todo. Hoy scrollea el documento (window), pero <main> tiene
// overflow-auto y pasaría a scrollear él si el layout fija la altura: se hacen los dos.
export function scrollContenidoArriba(behavior: ScrollBehavior = 'auto') {
  document.querySelector('main')?.scrollTo({ top: 0, behavior });
  window.scrollTo({ top: 0, behavior });
}
