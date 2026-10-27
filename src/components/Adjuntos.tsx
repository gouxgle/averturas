import { useRef, useState } from 'react';
import { X, FileText, ImagePlus, RefreshCw, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { esPdf, esVideo, subirArchivo } from '@/lib/adjuntos';

// Adjuntos compartidos (Compras, servicios técnicos): miniaturas y zona para subir. Cada módulo tiene su endpoint de
// subida; todos devuelven `{ url }` y guardan en /uploads.

/** Miniaturas de adjuntos (imágenes, videos y PDFs) con quitar opcional. Los videos se reproducen en grande. */
export function AdjuntosGrid({ urls, onRemove, size = 'md' }: { urls: string[]; onRemove?: (url: string) => void; size?: 'sm' | 'md' | 'lg' }) {
  const [video, setVideo] = useState<string | null>(null);
  if (!urls?.length) return null;
  const dim = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-28 h-28' : 'w-20 h-20';
  const ico = size === 'sm' ? 16 : 22;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map(u => (
        <div key={u} className={cn('relative group rounded-lg border border-gray-200 overflow-hidden bg-gray-50', dim)}>
          {esVideo(u) ? (
            <button type="button" onClick={() => setVideo(u)} title="Ver video" className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-gray-900 text-white">
              <Play size={ico} /><span className="text-[9px] font-bold">VIDEO</span>
            </button>
          ) : (
            <a href={u} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              {esPdf(u)
                ? <div className="w-full h-full flex flex-col items-center justify-center text-red-600 gap-0.5"><FileText size={ico} /><span className="text-[9px] font-bold">PDF</span></div>
                : <img src={u} alt="" className="w-full h-full object-cover" />}
            </a>
          )}
          {onRemove && (
            <button type="button" onClick={() => onRemove(u)} title="Quitar"
              className="absolute top-0.5 right-0.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      {video && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-3" onClick={() => setVideo(null)}>
          <div className="relative w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setVideo(null)} className="absolute -top-11 right-0 h-10 w-10 rounded-full bg-white/90 flex items-center justify-center" title="Cerrar">
              <X size={18} />
            </button>
            <video src={video} controls autoPlay playsInline className="w-full max-h-[80dvh] rounded-xl bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Zona de adjuntos (click / arrastrar / pegar). En el celular, el selector ofrece la cámara. */
export function DropzoneAdjuntos({ onAdd, compacto, accept = 'image/*,application/pdf', endpoint = '/api/compras/adjuntos', texto, textoCompacto }: {
  onAdd: (url: string) => void;
  compacto?: boolean;
  accept?: string;
  endpoint?: string;
  texto?: string;
  textoCompacto?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(files: FileList | File[]) {
    setSubiendo(true);
    try {
      for (const f of Array.from(files)) {
        const r = await subirArchivo(endpoint, f);
        onAdd(r.url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally { setSubiendo(false); }
  }

  return (
    <div tabIndex={0}
      onPaste={e => { const fs = Array.from(e.clipboardData.files ?? []); if (fs.length) { e.preventDefault(); subir(fs); } }}
      onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.length) subir(e.dataTransfer.files); }}
      onDragOver={e => e.preventDefault()}
      onClick={() => !subiendo && ref.current?.click()}
      className={cn('flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-lime-400 hover:bg-lime-50/40 transition-colors focus:outline-none focus:ring-2 focus:ring-lime-300',
        compacto ? 'py-2 px-3' : 'py-4 px-3')}>
      {subiendo ? <RefreshCw size={18} className="text-gray-500 animate-spin" /> : <ImagePlus size={18} className="text-gray-500" />}
      <p className="text-xs text-gray-600 text-center">
        {subiendo ? 'Subiendo…' : compacto ? (textoCompacto ?? 'Agregar foto o PDF') : (texto ?? 'Fotos, planos o PDF — hacé click, arrastrá o pegá (Ctrl+V)')}
      </p>
      <input ref={ref} type="file" accept={accept} multiple className="hidden"
        onChange={e => { if (e.target.files?.length) subir(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
