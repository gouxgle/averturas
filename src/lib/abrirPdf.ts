// Abre un PDF de la API en otra pestaña. Las rutas /api piden el token en el header (no hay
// cookie), así que no alcanza con un <a href>: se baja como blob y se abre la URL local.
export async function abrirPdfApi(path: string): Promise<void> {
  const ventana = window.open('', '_blank');   // se abre antes del await: si no, el navegador la bloquea
  const token = sessionStorage.getItem('aberturas_token');
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    ventana?.close();
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Error ${res.status}`);
  }
  const url = URL.createObjectURL(await res.blob());
  if (ventana) ventana.location.href = url; else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
