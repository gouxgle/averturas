import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  accent?: string;
}

// Card de sección para páginas-formulario (Nuevo recibo, Nuevo pedido, etc.).
export function SectionCard({ title, icon: Icon, children, accent }: SectionCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-400 shadow-lg">
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b rounded-t-xl',
        accent ?? 'bg-gray-50 border-gray-200',
      )}>
        <Icon size={13} className={accent ? 'opacity-70' : 'text-gray-600'} />
        <span className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          accent ? '' : 'text-gray-600',
        )}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
