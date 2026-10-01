import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { TareaAgenda } from '@/lib/agenda';
import { completar } from './acciones';

/**
 * Después de guardar los cambios de una proforma con una recotización pendiente, pregunta si
 * quedó lista. Es un aviso con botones (no un modal): no frena la navegación. "Sí, lista"
 * completa la tarea; "Todavía no" o dejarlo pasar la deja en la agenda.
 */
export async function preguntarRecotizacion(operacionId: string, numero: string) {
  const t = await api.get<TareaAgenda | null>(`/agenda/recotizar/${operacionId}`, { silent: true }).catch(() => null);
  if (!t) return;
  toast(`¿Quedó lista la recotización de ${numero}?`, {
    description: 'Si está lista, sale de la agenda.',
    duration: 30_000,
    action: {
      label: 'Sí, lista',
      onClick: () => { completar(t.id).then(() => toast.success('Recotización hecha')).catch(() => {}); },
    },
    cancel: { label: 'Todavía no', onClick: () => {} },
  });
}
