import { useRef, useState, useEffect, useImperativeHandle, type Ref } from 'react';
import { Eraser, Save, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FirmaDigitalProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** Endpoint de subida — cada sección tiene el suyo (sharp la convierte a webp
   * igual que cualquier otra foto). Default: visitas técnicas, el primer uso. */
  uploadEndpoint?: string;
  /** Canvas más alto en el celular (entrega en el lugar). */
  grande?: boolean;
  /** Sin botón "Guardar firma": quien lo usa sube la firma al confirmar vía `ref.subir()`. */
  sinGuardar?: boolean;
  ref?: Ref<FirmaDigitalHandle>;
}

export interface FirmaDigitalHandle {
  /** Hay algo dibujado sin guardar todavía. */
  tieneTrazo(): boolean;
  /** Sube lo dibujado y devuelve la URL; null si no hay trazo (o la firma ya guardada). */
  subir(): Promise<string | null>;
}

// Firma de conformidad capturada en el celular de quien está en el lugar
// (técnico en la visita, repartidor al entregar). Canvas puro (sin librería) —
// pointer events cubre dedo, stylus y mouse.
export function FirmaDigital({
  value, onChange, disabled, uploadEndpoint = '/api/visitas-tecnicas/upload-imagen', grande, sinGuardar, ref,
}: FirmaDigitalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [firmando, setFirmando] = useState(!value);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!firmando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Resolución real de la pantalla (en un celular devicePixelRatio es 2-3): con un
    // canvas fijo de 600 px el trazo salía pixelado al ampliarse a lo ancho.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth;
    if (w > 0) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fondo blanco: el PNG exportado no debe quedar transparente.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5 * (w > 0 ? dpr : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    hasStroke.current = false;
  }, [firmando]);

  function posFromEvent(canvas: HTMLCanvasElement, e: React.PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = posFromEvent(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = posFromEvent(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke.current = true;
  }

  function handlePointerUp() {
    drawing.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
  }

  async function subirCanvas(canvas: HTMLCanvasElement): Promise<string> {
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen');
    const token = sessionStorage.getItem('aberturas_token');
    const fd = new FormData();
    fd.append('imagen', blob, 'firma.png');
    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error('Error al subir la firma');
    const { url } = await res.json();
    return url as string;
  }

  useImperativeHandle(ref, () => ({
    tieneTrazo: () => firmando && hasStroke.current,
    async subir() {
      const canvas = canvasRef.current;
      if (!firmando || !canvas || !hasStroke.current) return null;
      const url = await subirCanvas(canvas);
      onChange(url);
      setFirmando(false);
      return url;
    },
  }));

  async function guardarFirma() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasStroke.current) { toast.error('Dibujá la firma antes de guardar'); return; }
    setGuardando(true);
    try {
      onChange(await subirCanvas(canvas));
      setFirmando(false);
      toast.success('Firma guardada');
    } catch {
      toast.error('No se pudo guardar la firma');
    } finally {
      setGuardando(false);
    }
  }

  if (disabled) {
    return value
      ? <img src={value} alt="Firma del cliente" className="h-24 border border-gray-200 rounded-lg bg-white" />
      : <p className="text-xs text-gray-600">Sin firma</p>;
  }

  if (!firmando && value) {
    return (
      <div className="space-y-2">
        <img src={value} alt="Firma del cliente" className={cn('border border-gray-200 rounded-lg bg-white', grande ? 'h-32' : 'h-24')} />
        <button type="button" onClick={() => setFirmando(true)}
          className={cn('flex items-center gap-1.5 font-semibold text-slate-600 hover:underline', grande ? 'text-sm h-11' : 'text-xs')}>
          <PenLine size={13} /> Firmar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Espacio para firmar"
        className={cn(
          'w-full rounded-xl border-2 border-dashed border-gray-300 bg-white touch-none select-none overscroll-contain',
          grande ? 'aspect-[3/2] sm:aspect-[5/2]' : 'aspect-[3/1]',
        )}
      />
      <div className="flex gap-2">
        <button type="button" onClick={limpiar}
          className={cn('flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50',
            grande ? 'h-11 text-sm' : 'py-2 text-xs')}>
          <Eraser size={13} /> Limpiar
        </button>
        {!sinGuardar && (
          <button type="button" onClick={guardarFirma} disabled={guardando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
            {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar firma
          </button>
        )}
      </div>
    </div>
  );
}
