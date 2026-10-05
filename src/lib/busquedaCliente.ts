// Búsqueda de clientes en pantalla. Mismo criterio que el servidor (clienteSearchSql):
// cada palabra se busca por separado y todas deben aparecer en algún dato del cliente, sin
// importar el orden, las tildes, las mayúsculas ni la coma de "Apellido, Nombre".
// Los teléfonos y documentos se comparan solo con dígitos ("3704-72 3063" encuentra "+5493704723063").

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function palabrasDeBusqueda(q: string): string[] {
  return q.trim().split(/[\s,;]+/)
    .map(p => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

export interface DatosBuscables {
  nombre?: string | null; apellido?: string | null; razon_social?: string | null;
  telefono?: string | null; telefono_fijo?: string | null; email?: string | null;
  localidad?: string | null; direccion?: string | null; documento_nro?: string | null; notas?: string | null;
}

export function coincideBusqueda(c: DatosBuscables, q: string): boolean {
  const palabras = palabrasDeBusqueda(q);
  if (!palabras.length) return true;
  const texto = sinAcentos([c.apellido, c.nombre, c.razon_social, c.email, c.localidad, c.direccion, c.notas, c.telefono, c.documento_nro]
    .filter(Boolean).join(' '));
  const numeros = [c.telefono, c.telefono_fijo, c.documento_nro].map(v => (v ?? '').replace(/\D/g, '')).filter(Boolean);
  return palabras.every(p => {
    if (texto.includes(sinAcentos(p))) return true;
    const d = p.replace(/\D/g, '');
    return d.length >= 4 && numeros.some(n => n.includes(d.slice(-10)));
  });
}
