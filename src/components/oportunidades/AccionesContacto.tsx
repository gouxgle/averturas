import { useState } from 'react';
import { MessageCircle, Phone, Mail, Send, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Oportunidad } from './types';

// Contacto rápido desde una oportunidad: WhatsApp (Evolution API, con mensaje
// sugerido editable) / Llamar / Email. Los 3 pasan la oportunidad a
// "contactada" vía POST /:id/contactar — WhatsApp porque efectivamente se
// mandó el mensaje, Llamar/Email porque abrir el link es una acción real y
// deliberada del vendedor (mismo nivel de certeza que "se envió el WhatsApp").
export function AccionesContacto({ oportunidad, onContactado }: {
  oportunidad: Oportunidad;
  onContactado: (actualizada: Oportunidad) => void;
}) {
  const [showWa, setShowWa] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const telefono = oportunidad.cliente?.telefono;
  const email = oportunidad.cliente?.email;

  async function abrirWhatsapp() {
    setShowWa(true);
    setCargandoPlantilla(true);
    try {
      const r = await api.get<{ mensaje: string }>(`/oportunidades/plantilla/${oportunidad.id}`);
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
      const actualizada = await api.post<Oportunidad>(`/oportunidades/${oportunidad.id}/contactar`, {
        canal: 'whatsapp', mensaje,
      });
      toast.success('WhatsApp enviado');
      setShowWa(false);
      onContactado(actualizada);
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  }

  function registrarContacto(canal: 'llamada' | 'email') {
    api.post<Oportunidad>(`/oportunidades/${oportunidad.id}/contactar`, { canal })
      .then(onContactado)
      .catch(() => {});
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
        <a href={`tel:${telefono}`} title="Llamar" onClick={() => registrarContacto('llamada')}
          className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-600 transition-colors">
          <Phone size={14} />
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} title="Enviar email" onClick={() => registrarContacto('email')}
          className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600 transition-colors">
          <Mail size={14} />
        </a>
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
