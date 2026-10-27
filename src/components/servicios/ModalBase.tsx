import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Contenedor de los modales de servicios técnicos: hoja desde abajo en el celular, centrado en la compu. Portal al
// body para que la barra lateral o el buzón no le pasen por encima.
export function ModalBase({ titulo, icono, onClose, children, pie, ancho = 'sm:max-w-lg', testId }: {
  titulo: ReactNode; icono?: ReactNode; onClose: () => void; children: ReactNode; pie?: ReactNode; ancho?: string; testId?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[9100] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
      <div className={cn('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col', ancho)}
        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" data-testid={testId}>
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-200 flex items-center gap-2">
          {icono}
          <h2 className="text-base font-bold text-gray-900 min-w-0 truncate">{titulo}</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:bg-gray-100" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">{children}</div>
        {pie && <div className="px-4 sm:px-5 py-3 border-t border-gray-200 flex flex-wrap gap-2 justify-end">{pie}</div>}
      </div>
    </div>,
    document.body,
  );
}
