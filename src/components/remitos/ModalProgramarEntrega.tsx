import { useState } from 'react';
import { X, CalendarClock, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface RemitoParaProgramar {
  id: string;
  fecha_entrega_est: string | null;
  hora_entrega_est: string | null;
  direccion_entrega: string | null;
  notas: string | null;
}

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fecha + hora + dirección + observaciones de una entrega — reusable desde
// Remitos.tsx (por fila, funciona en borrador o emitido) y NuevoRemito.tsx.
// Llama PATCH /remitos/:id/programar-entrega, que además crea/actualiza la
// tarea espejo en la agenda del CRM (tipo_accion='entrega') y resetea los
// recordatorios si la fecha/hora realmente cambiaron.
export function ModalProgramarEntrega({ remito, onClose, onSuccess }: {
  remito: RemitoParaProgramar;
  onClose: () => void;
  onSuccess: (r: any) => void;
}) {
  const [fecha, setFecha] = useState(remito.fecha_entrega_est?.slice(0, 10) ?? hoyISO());
  const [hora, setHora] = useState(remito.hora_entrega_est?.slice(0, 5) ?? '');
  const [direccion, setDireccion] = useState(remito.direccion_entrega ?? '');
  const [notas, setNotas] = useState(remito.notas ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!fecha) { setError('Elegí la fecha de entrega'); return; }

    setSaving(true);
    try {
      const r = await api.patch(`/remitos/${remito.id}/programar-entrega`, {
        fecha_entrega_est: fecha,
        hora_entrega_est: hora || null,
        direccion_entrega: direccion.trim() || null,
        notas: notas.trim() || null,
      });
      toast.success('Entrega programada');
      onSuccess(r);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo programar la entrega');
    } finally {
      setSaving(false);
    }
  }

  const inp = 'w-full px-3 py-2 border border-gray-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
  const lbl = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-sky-600 sticky top-0">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-white" />
            <h2 className="text-sm font-bold text-white">Programar entrega</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X size={16} className="text-white" /></button>
        </div>

        <div className="p-6 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 text-red-700 rounded-xl text-xs">
              <AlertTriangle size={13} className="shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Horario</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Dirección de entrega</label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)}
              placeholder="Calle, número, localidad" className={inp} />
          </div>

          <div>
            <label className={lbl}>Observaciones</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Ej: llamar antes de llegar" className={inp} />
          </div>

          <p className="text-[11px] text-gray-600">
            Se van a generar recordatorios automáticos: un día antes, el mismo día en el panel y la agenda,
            y una hora antes con accesos rápidos para llamar, ver la ubicación o avisar por WhatsApp.
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-400 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Programar entrega
          </button>
        </div>
      </div>
    </div>
  );
}
