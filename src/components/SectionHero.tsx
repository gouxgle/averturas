import { type LucideIcon } from 'lucide-react';

interface SectionHeroProps {
  section: string;
  icon: LucideIcon;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}

const SECTION_COLORS: Record<string, { icon: string; mark: string }> = {
  dashboard:    { icon: '#1d4ed8', mark: 'rgba(29,78,216,0.10)' },
  crm:          { icon: '#be123c', mark: 'rgba(190,18,60,0.10)' },
  presupuestos: { icon: '#6d28d9', mark: 'rgba(109,40,217,0.10)' },
  operaciones:  { icon: '#b45309', mark: 'rgba(180,83,9,0.10)' },
  remitos:      { icon: '#0f766e', mark: 'rgba(15,118,110,0.10)' },
  pedidos:      { icon: '#4d7c0f', mark: 'rgba(77,124,15,0.10)' },
  recibos:      { icon: '#047857', mark: 'rgba(4,120,87,0.10)' },
  clientes:     { icon: '#0e7490', mark: 'rgba(14,116,144,0.10)' },
  estado:       { icon: '#4338ca', mark: 'rgba(67,56,202,0.10)' },
  productos:    { icon: '#0369a1', mark: 'rgba(3,105,161,0.10)' },
  stock:        { icon: '#c2410c', mark: 'rgba(194,65,12,0.10)' },
  proveedores:  { icon: '#b45309', mark: 'rgba(180,83,9,0.10)' },
  reportes:     { icon: '#7e22ce', mark: 'rgba(126,34,206,0.10)' },
  config:       { icon: '#475569', mark: 'rgba(71,85,105,0.10)' },
};

export function SectionHero({ section, icon: Icon, title, sub, actions }: SectionHeroProps) {
  const colors = SECTION_COLORS[section] ?? { icon: '#031d49', mark: 'rgba(3,29,73,0.08)' };

  return (
    <div className="section-hero">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Icon mark */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.6)' }}
        >
          <Icon size={26} style={{ color: colors.icon }} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: colors.icon }}>
            César Brítez Aberturas
            <span className="opacity-40 mx-1.5">/</span>
            <span>{title}</span>
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-tight">
            {title}
          </h1>
          {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
