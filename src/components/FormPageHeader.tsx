import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

interface FormPageHeaderProps {
  onBack: () => void;
  icon: LucideIcon;
  /** Clases de color del mark del ícono, ej. "bg-teal-100 text-teal-600" */
  iconColorClass: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Botón/acción de la derecha (ej. "Guardar", "Imprimir") */
  action?: React.ReactNode;
}

// Encabezado canónico de páginas-formulario (Nuevo remito, Nuevo recibo, etc.).
// flex-col sm:flex-row: en mobile el título ocupa su fila completa y la acción
// baja debajo, en vez de apretarse contra un título largo (mismo criterio que
// SectionHero — ver CLAUDE.md "Responsive mobile").
export function FormPageHeader({ onBack, icon: Icon, iconColorClass, title, sub, action }: FormPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColorClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{title}</h1>
          {sub && <div className="text-sm text-gray-600">{sub}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-auto">{action}</div>}
    </div>
  );
}
