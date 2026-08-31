import { useRef, useState, useEffect } from 'react';
import { Eraser, Save, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';

interface FirmaDigitalProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

// Firma del cliente dando conformidad a las medidas relevadas. Canvas puro
// (sin librería) — pointer events cubre dedo, stylus y mouse. Sube el trazo
// como imagen al mismo endpoint que las fotos de la visita (sharp la
// convierte a webp igual que cualquier otra foto).
export function FirmaDigital({ value, onChange, disabled }: FirmaDigitalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [firmando, setFirmando] = useState(!value);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!firmando) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fondo blanco: el PNG exportado no debe quedar transparente.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
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

  async function guardarFirma() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasStroke.current) { toast.error('Dibujá la firma antes de guardar'); return; }
    setGuardando(true);
    try {
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen');
      const token = sessionStorage.getItem('aberturas_token');
      const fd = new FormData();
      fd.append('imagen', blob, 'firma.png');
      const res = await fetch('/api/visitas-tecnicas/upload-imagen', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Error al subir la firma');
      const { url } = await res.json();
      onChange(url);
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
        <img src={value} alt="Firma del cliente" className="h-24 border border-gray-200 rounded-lg bg-white" />
        <button type="button" onClick={() => setFirmando(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:underline">
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
        className="w-full aspect-[3/1] rounded-xl border-2 border-dashed border-gray-300 bg-white touch-none"
      />
      <div className="flex gap-2">
        <button type="button" onClick={limpiar}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <Eraser size={13} /> Limpiar
        </button>
        <button type="button" onClick={guardarFirma} disabled={guardando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold disabled:opacity-50">
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar firma
        </button>
      </div>
    </div>
  );
}
