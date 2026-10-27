// Subida y tipo de adjuntos (los usan src/components/Adjuntos.tsx y quien necesite saber si un adjunto es video).
export const esPdf = (url: string) => /\.pdf($|\?)/i.test(url);
export const esVideo = (url: string) => /\.(mp4|mov|webm|3gp)($|\?)/i.test(url);

export async function subirArchivo(endpoint: string, file: File): Promise<{ url: string; nombre: string; tipo: string }> {
  const token = sessionStorage.getItem('aberturas_token');
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await fetch(endpoint, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  if (!res.ok) {
    if (res.status === 413) {
      const err = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(err?.error ?? 'El archivo es demasiado grande');
    }
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Error al subir el archivo');
  }
  return res.json();
}
