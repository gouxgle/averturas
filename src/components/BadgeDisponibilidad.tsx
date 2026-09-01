import { Zap, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { disponibilidadProducto, type EstadoDisponibilidad } from '@/lib/disponibilidad';
import type { Producto } from '@/types';

// Cuándo se puede entregar este producto. Reemplaza (no acompaña) al viejo badge
// "Sin confirmar" de la tarjeta: aquella condición era exactamente el caso
// "estimada ∪ desconocida" de esta cascada, y tener los dos duplicaba el mensaje.

const ESTILO: Record<EstadoDisponibilidad, { cls: string; Icon: React.ElementType }> = {
  inmediata:   { cls: 'bg-emerald-600 text-white',            Icon: Zap },
  confirmada:  { cls: 'bg-sky-600 text-white',                Icon: CheckCircle2 },
  estimada:    { cls: 'bg-amber-500 text-white',              Icon: Clock },
  desconocida: { cls: 'bg-white/90 text-gray-600 border border-gray-200', Icon: HelpCircle },
};

export function BadgeDisponibilidad({ producto, className }: { producto: Producto; className?: string }) {
  const d = disponibilidadProducto(producto);
  const { cls, Icon } = ESTILO[d.estado];
  return (
    <span title={d.detalle}
      className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full leading-none shadow-md flex items-center gap-1', cls, className)}>
      <Icon size={8}/>{d.label}
    </span>
  );
}

/** Versión en línea, para el modal de detalle (sin sombra, texto normal). */
export function LineaDisponibilidad({ producto }: { producto: Producto }) {
  const d = disponibilidadProducto(producto);
  const { cls, Icon } = ESTILO[d.estado];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-600">Disponibilidad</span>
      <span title={d.detalle}
        className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full leading-none flex items-center gap-1', cls)}>
        <Icon size={10}/>{d.label}
      </span>
    </div>
  );
}
