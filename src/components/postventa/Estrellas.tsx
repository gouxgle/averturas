import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Calificación de 1 a 5. Con `onChange` se puede tocar (botones de 44 px para el celular); sin él, solo se ve. */
export function Estrellas({ value, onChange, tam = 18, etiqueta }: {
  value: number | null; onChange?: (v: number) => void; tam?: number; etiqueta?: string;
}) {
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${etiqueta ? `${etiqueta}: ` : ''}${value ?? 'sin dato'} de 5`}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star key={n} size={tam} className={cn(value && n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center" role="radiogroup" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5`} onClick={() => onChange(n)}
          className="w-11 h-11 flex items-center justify-center">
          <Star size={tam + 10} className={cn('transition-colors', value && n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
        </button>
      ))}
    </span>
  );
}
