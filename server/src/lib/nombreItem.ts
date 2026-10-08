// Nombre legible de un ítem: "tipo de abertura + detalle". Un producto del catálogo
// cargado en el presupuesto guarda la descripción como "CÓDIGO — Nombre" (NuevoPresupuesto)
// y así pasaba al remito y a la factura ("MOSQ-1,50x1,00 — Mosq p/ventana…"). Misma regla
// que src/lib/itemRemito.ts del frontend (duplicada a propósito: front y back no comparten código).
export function nombreItem(descripcion: string, codigo?: string | null, tipo?: string | null): string {
  let detalle = String(descripcion ?? '').trim();
  const cod = codigo?.trim();
  if (cod && detalle.toLowerCase().startsWith(cod.toLowerCase())) {
    const resto = detalle.slice(cod.length).replace(/^\s*[—–\-:]\s*/, '').trim();
    if (resto) detalle = resto;
  }
  const t = tipo?.trim();
  return t && !detalle.toLowerCase().startsWith(t.toLowerCase()) ? `${t} — ${detalle}` : detalle;
}
