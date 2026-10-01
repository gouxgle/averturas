import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBotonAgenda } from '@/lib/agenda';

// En la barra superior: cuántas tareas quedan hoy (en rojo si hay atrasadas). Abre el aviso.
export function BotonAgenda() {
  const { total, atrasadas, abrir } = useBotonAgenda();
  if (!total || !abrir) return null;
  return (
    <button type="button" onClick={abrir}
      className={cn('h-9 px-2 sm:pl-2.5 sm:pr-3 rounded-full text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1 sm:gap-1.5 shadow-md transition-colors shrink-0',
        atrasadas ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500')}
      aria-label={`Agenda de hoy: ${total} pendiente${total !== 1 ? 's' : ''}`} title="Tu agenda de hoy">
      <CalendarDays size={16} />
      <span className="tabular-nums">{total}</span>
      <span className="hidden md:inline">pendiente{total !== 1 ? 's' : ''} hoy</span>
    </button>
  );
}
