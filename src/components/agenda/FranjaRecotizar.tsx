import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePenLine, Loader2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { type TareaAgenda, diaAR, fechaCorta, horaCorta, avisarCambioAgenda } from '@/lib/agenda';

// En el detalle de una proforma: agendar su recotización (revisarla y adecuarla a lo que
// pidió el cliente) o ver la que ya está agendada. Hay una sola pendiente por proforma:
// agendar de nuevo cambia la fecha de la existente.
export function FranjaRecotizar({ operacionId, soloLectura }: { operacionId: string; soloLectura?: boolean }) {
  const [tarea, setTarea] = useState<TareaAgenda | null | undefined>(undefined);
  const [form, setForm] = useState(false);
  const [fecha, setFecha] = useState(diaAR(1));
  const [hora, setHora] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api.get<TareaAgenda | null>(`/agenda/recotizar/${operacionId}`).then(setTarea).catch(() => setTarea(null));
  useEffect(() => { cargar(); }, [operacionId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    if (!fecha || guardando) return;
    setGuardando(true);
    try {
      await api.post('/agenda/recotizar', { operacion_id: operacionId, fecha, hora: hora || null, nota: nota.trim() || null });
      toast.success('Recotización agendada');
      avisarCambioAgenda();
      setForm(false);
      await cargar();
    } catch (e) {
      toast.error('No se pudo agendar', { description: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  if (tarea === undefined) return null;

  return (
    <div className="mx-5 mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <FilePenLine size={16} className="text-orange-600 shrink-0" />
        {tarea ? (
          <p className="flex-1 min-w-[12rem] text-xs text-orange-900">
            <b>Recotización agendada</b> para el {fechaCorta(tarea.vencimiento)}{tarea.hora ? ` a las ${horaCorta(tarea.hora)}` : ''}
            {tarea.notas && <span className="block text-orange-800 italic mt-0.5">{tarea.notas}</span>}
          </p>
        ) : (
          <p className="flex-1 min-w-[12rem] text-xs text-orange-900">¿Hay que revisar esta proforma y adecuarla a lo que pidió el cliente? Agendala para que no se pierda.</p>
        )}
        <div className="flex gap-1.5">
          {tarea && (
            <Link to={`/presupuestos/${operacionId}/editar`}
              className="px-3 py-1.5 bg-white border border-orange-300 text-orange-800 text-xs font-bold rounded-lg hover:bg-orange-100">
              Editar proforma
            </Link>
          )}
          {!soloLectura && (
            <button onClick={() => { setForm(f => !f); if (tarea?.vencimiento && tarea.vencimiento >= diaAR(0)) setFecha(tarea.vencimiento); }}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1">
              <CalendarClock size={13} /> {tarea ? 'Cambiar fecha' : 'Agendar recotización'}
            </button>
          )}
        </div>
      </div>
      {form && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input type="date" value={fecha} min={diaAR(0)} onChange={e => setFecha(e.target.value)} aria-label="Fecha de la recotización"
            className="h-9 px-2 rounded-lg border border-orange-300 bg-white text-sm" />
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} aria-label="Hora (opcional)"
            className="h-9 px-2 rounded-lg border border-orange-300 bg-white text-sm" />
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Qué hay que cambiar (opcional)" maxLength={2000}
            className="h-9 px-2 rounded-lg border border-orange-300 bg-white text-sm flex-1 min-w-[10rem]" />
          <button onClick={guardar} disabled={!fecha || guardando}
            className="h-9 px-3 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-1">
            {guardando && <Loader2 size={13} className="animate-spin" />} Guardar
          </button>
        </div>
      )}
    </div>
  );
}
