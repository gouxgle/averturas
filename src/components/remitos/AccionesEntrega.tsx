import { useState } from 'react';
import { MessageCircle, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Accesos rápidos para una entrega próxima: llamar / ubicación / WhatsApp con
// mensaje sugerido editable. Calco de AccionesContacto.tsx (oportunidades),
// mismo patrón: tel:, window.open a Maps (sin geocoding, solo la dirección en
// texto) y popover de WhatsApp que llama al endpoint de plantilla + envío.
export function AccionesEntrega({ remitoId, telefono, direccionEntrega, onEnviado }: {
  remitoId: string;
  telefono: string | null | undefined;
  direccionEntrega: string | null | undefined;
  onEnviado?: () => void;
}) {
  const [showWa, setShowWa] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function abrirWhatsapp() {
    setShowWa(true);
    setCargandoPlantilla(true);
    try {
      const r = await api.get<{ mensaje: string }>(`/remitos/${remitoId}/plantilla-entrega`);
      setMensaje(r.mensaje);
    } catch {
      setMensaje('');
    } finally {
      setCargandoPlantilla(false);
    }
  }

  async function enviarWhatsapp() {
    if (!mensaje.trim()) return;
    setEnviando(true);
    try {
      await api.post(`/remitos/${remitoId}/recordatorio-whatsapp`, { mensaje });
      toast.success('WhatsApp enviado');
      setShowWa(false);
      onEnviado?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  }

  function abrirUbicacion() {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionEntrega ?? '')}`;
    window.open(url, '_blank');
  }

  return (
    <div className="relative flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {telefono && (
        <button type="button" onClick={abrirWhatsapp} title="Enviar WhatsApp"
          className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
          <MessageCircle size={14} />
        </button>
      )}
      {telefono && (
        <a href={`tel:${telefono}`} title="Llamar"
          className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-600 transition-colors">
          <Phone size={14} />
        </a>
      )}
      {direccionEntrega && (
        <button type="button" onClick={abrirUbicacion} title="Abrir ubicación"
          className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600 transition-colors">
          <MapPin size={14} />
        </button>
      )}

      {showWa && (
        <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-3"
          onClick={e => e.stopPropagation()}>
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Mensaje sugerido</p>
          {cargandoPlantilla ? (
            <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-600" /></div>
          ) : (
            <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} rows={5}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-300" />
          )}
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setShowWa(false)}
              className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="button" onClick={enviarWhatsapp} disabled={enviando || !mensaje.trim()}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 disabled:opacity-50',
                'bg-green-600 hover:bg-green-700'
              )}>
              {enviando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
