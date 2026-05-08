import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users,
  FileText, Hammer, Layers, Boxes, TrendingUp,
  SlidersHorizontal, ChevronRight, LogOut, X, Truck, Receipt, BookOpen
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  activeColor: string;
  activeBg: string;
}

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard, activeColor: 'text-blue-400',    activeBg: 'bg-blue-500/10' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { to: '/presupuestos',  label: 'Presupuestos',   icon: FileText,        activeColor: 'text-violet-400',  activeBg: 'bg-violet-500/10' },
      { to: '/operaciones',   label: 'Operaciones',    icon: Hammer,          activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/10' },
      { to: '/remitos',       label: 'Remitos',        icon: Truck,           activeColor: 'text-teal-400',    activeBg: 'bg-teal-500/10' },
      { to: '/recibos',       label: 'Recibos',        icon: Receipt,         activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/10' },
      { to: '/clientes',      label: 'Clientes',       icon: Users,           activeColor: 'text-cyan-400',    activeBg: 'bg-cyan-500/10' },
      { to: '/estado-cuenta', label: 'Estado de Cuenta', icon: BookOpen,       activeColor: 'text-indigo-400',  activeBg: 'bg-indigo-500/10' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/productos',     label: 'Productos',      icon: Layers,          activeColor: 'text-sky-400',     activeBg: 'bg-sky-500/10' },
      { to: '/stock',         label: 'Existencias',    icon: Boxes,           activeColor: 'text-orange-400',  activeBg: 'bg-orange-500/10' },
      { to: '/proveedores',   label: 'Proveedores',    icon: Truck,           activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/10' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/reportes',      label: 'Reportes',       icon: TrendingUp,      activeColor: 'text-purple-400',  activeBg: 'bg-purple-500/10' },
      { to: '/configuracion', label: 'Configuración',  icon: SlidersHorizontal, activeColor: 'text-slate-300', activeBg: 'bg-slate-500/10' },
    ],
  },
];

// Logo mark: 2×2 cuadros redondeados (versión para fondo oscuro)
function LogoMark({ size = 36 }: { size?: number }) {
  const gap = Math.round(size * 0.083);   // ~3px para 36px
  const sq  = Math.round((size - gap * 3) / 2);
  const r   = Math.round(sq * 0.22);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      {/* Top-left: blanco brillante */}
      <rect x={gap} y={gap} width={sq} height={sq} rx={r} fill="rgba(255,255,255,0.90)" />
      {/* Top-right: rojo marca */}
      <rect x={gap * 2 + sq} y={gap} width={sq} height={sq} rx={r} fill="#e31e24" />
      {/* Bottom-left: blanco semitransparente */}
      <rect x={gap} y={gap * 2 + sq} width={sq} height={sq} rx={r} fill="rgba(255,255,255,0.45)" />
      {/* Bottom-right: blanco muy tenue */}
      <rect x={gap * 2 + sq} y={gap * 2 + sq} width={sq} height={sq} rx={r} fill="rgba(255,255,255,0.20)" />
    </svg>
  );
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const initials = user?.nombre
    ? user.nombre.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <aside className="w-64 lg:w-60 h-full min-h-screen flex flex-col select-none" style={{ backgroundColor: '#031d49' }}>

      {/* Header: logo + nombre empresa */}
      <div className="h-16 flex items-center px-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <LogoMark size={36} />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-white tracking-wide leading-tight truncate">
              CÉSAR BRÍTEZ
            </p>
            <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#e31e24' }}>
              Aberturas
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg transition-colors ml-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-0.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
            {group.label && (
              <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pb-1.5 pt-1"
                style={{ color: 'rgba(255,255,255,0.30)' }}>
                {group.label}
              </p>
            )}
            {group.items.map(({ to, label, icon: Icon, activeColor, activeBg }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                    isActive ? cn('text-white', activeBg) : 'hover:bg-white/5'
                  )
                }
                style={({ isActive }) => isActive ? {} : { color: 'rgba(255,255,255,0.55)' }}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full', activeColor.replace('text-', 'bg-'))} />
                    )}
                    <span className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                      isActive ? cn('bg-white/10', activeColor) : 'group-hover:text-white/80'
                    )} style={isActive ? {} : { color: 'rgba(255,255,255,0.40)' }}>
                      <Icon size={16} />
                    </span>
                    <span className="flex-1">{label}</span>
                    {isActive && <ChevronRight size={13} className={cn('opacity-50', activeColor)} />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Usuario */}
      <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: '#e31e24' }}>
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.90)' }}>
              {user?.nombre ?? 'Usuario'}
            </p>
            <p className="text-[10px] capitalize" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {user?.rol ?? ''}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
