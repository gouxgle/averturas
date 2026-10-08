// Cómo se nombra un ítem de remito en pantalla e impresión: "tipo de abertura + detalle".
// Al cargar un producto del catálogo en el presupuesto, la descripción se guarda como
// "CÓDIGO — Nombre" (NuevoPresupuesto) y el remito la hereda: en el detalle se leía
// "MOSQ-1,50x1,00 — Mosq p/ventana de 1,50x1,00 cm". El código va aparte, chico.

export interface ItemRemitoDescribible {
  descripcion: string;
  tipo_abertura_nombre?: string | null;
  producto_codigo?: string | null;
  producto?: { codigo?: string | null } | null;
}

export interface ItemRemitoDescripto {
  /** Tipo de abertura (ej. "Mosquera"); null si no se conoce o ya está en el detalle. */
  tipo: string | null;
  detalle: string;
  codigo: string | null;
}

export function describirItemRemito(it: ItemRemitoDescribible): ItemRemitoDescripto {
  const codigo = (it.producto_codigo ?? it.producto?.codigo ?? '').trim() || null;
  let detalle = it.descripcion.trim();
  if (codigo && detalle.toLowerCase().startsWith(codigo.toLowerCase())) {
    const resto = detalle.slice(codigo.length).replace(/^\s*[—–\-:]\s*/, '').trim();
    if (resto) detalle = resto;
  }
  const tipoRaw = it.tipo_abertura_nombre?.trim() || null;
  const tipo = tipoRaw && !detalle.toLowerCase().startsWith(tipoRaw.toLowerCase()) ? tipoRaw : null;
  return { tipo, detalle, codigo };
}

/** Versión en una línea, para listas y resúmenes. */
export function textoItemRemito(it: ItemRemitoDescribible): string {
  const { tipo, detalle } = describirItemRemito(it);
  return tipo ? `${tipo} — ${detalle}` : detalle;
}
