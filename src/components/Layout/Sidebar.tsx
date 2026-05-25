import { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users,
  FileText, Hammer, Layers, Boxes, TrendingUp,
  SlidersHorizontal, ChevronRight, LogOut, X, Truck, Receipt, BookOpen, GitBranch, ShoppingCart
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
      { to: '/dashboard',     label: 'Dashboard',        icon: LayoutDashboard, activeColor: 'text-blue-400',    activeBg: 'bg-blue-500/10' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { to: '/crm',           label: 'CRM',              icon: GitBranch,       activeColor: 'text-rose-400',    activeBg: 'bg-rose-500/10' },
      { to: '/presupuestos',  label: 'Presupuestos',     icon: FileText,        activeColor: 'text-violet-400',  activeBg: 'bg-violet-500/10' },
      { to: '/operaciones',   label: 'Operaciones',      icon: Hammer,          activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/10' },
      { to: '/remitos',       label: 'Remitos',          icon: Truck,           activeColor: 'text-teal-400',    activeBg: 'bg-teal-500/10' },
      { to: '/pedidos',       label: 'Pedidos',          icon: ShoppingCart,    activeColor: 'text-lime-400',    activeBg: 'bg-lime-500/10' },
      { to: '/recibos',       label: 'Recibos',          icon: Receipt,         activeColor: 'text-emerald-400', activeBg: 'bg-emerald-500/10' },
      { to: '/clientes',      label: 'Clientes',         icon: Users,           activeColor: 'text-cyan-400',    activeBg: 'bg-cyan-500/10' },
      { to: '/estado-cuenta', label: 'Estado de Cuenta', icon: BookOpen,        activeColor: 'text-indigo-400',  activeBg: 'bg-indigo-500/10' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/productos',     label: 'Productos',        icon: Layers,          activeColor: 'text-sky-400',     activeBg: 'bg-sky-500/10' },
      { to: '/stock',         label: 'Existencias',      icon: Boxes,           activeColor: 'text-orange-400',  activeBg: 'bg-orange-500/10' },
      { to: '/proveedores',   label: 'Proveedores',      icon: Truck,           activeColor: 'text-amber-400',   activeBg: 'bg-amber-500/10' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/reportes',      label: 'Reportes',         icon: TrendingUp,      activeColor: 'text-purple-400',  activeBg: 'bg-purple-500/10' },
      { to: '/configuracion', label: 'Configuración',    icon: SlidersHorizontal, activeColor: 'text-slate-300', activeBg: 'bg-slate-500/10' },
    ],
  },
];

function NavItemLink({ item, onClose }: { item: NavItem; onClose?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [tooltipTop, setTooltipTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { to, label, icon: Icon, activeColor, activeBg } = item;

  function handleMouseEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setTooltipTop(r.top + r.height / 2);
    }
    setHovered(true);
  }

  return (
    <div
      ref={ref}
      className="relative px-2 lg:px-1.5 mb-0.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <NavLink
        to={to}
        end={to === '/dashboard'}
        onClick={onClose}
        className={({ isActive }) => cn(
          'flex items-center gap-3 px-2 py-2 rounded-lg transition-all duration-150 relative',
          'lg:justify-center lg:px-0',
          isActive ? cn('text-white', activeBg) : hovered ? 'bg-white/5' : '',
        )}
        style={({ isActive }) => isActive ? {} : { color: 'rgba(255,255,255,0.55)' }}
      >
        {({ isActive }) => (
          <>
            {/* Indicador activo — barra izquierda */}
            {isActive && (
              <span className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full',
                activeColor.replace('text-', 'bg-')
              )} />
            )}

            {/* Icono */}
            <span className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 shrink-0',
              isActive
                ? cn('bg-white/10', activeColor)
                : hovered
                  ? cn(activeBg, activeColor, 'scale-110')
                  : '',
            )} style={!isActive && !hovered ? { color: 'rgba(255,255,255,0.45)' } : {}}>
              <Icon size={20} />
            </span>

            {/* Label — solo mobile */}
            <span className="flex-1 text-sm font-medium lg:hidden">{label}</span>
            {isActive && <ChevronRight size={13} className={cn('opacity-50 lg:hidden', activeColor)} />}
          </>
        )}
      </NavLink>

      {/* Tooltip: position:fixed para escapar del overflow-y:auto del nav */}
      <div
        className={cn(
          'hidden lg:flex items-center',
          'pointer-events-none whitespace-nowrap',
          'transition-all duration-150',
          hovered ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          position: 'fixed',
          top: tooltipTop,
          left: '3.75rem',
          transform: 'translateY(-50%)',
          zIndex: 9999,
        }}
      >
        <span className="border-4 border-transparent border-r-gray-800" />
        <span className={cn(
          'bg-gray-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xl',
          activeColor,
        )}>
          {label}
        </span>
      </div>
    </div>
  );
}

function LogoMark({ size = 36 }: { size?: number }) {
  const gap = Math.round(size * 0.083);
  const sq  = Math.round((size - gap * 3) / 2);
  const r   = Math.round(sq * 0.22);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <rect x={gap} y={gap} width={sq} height={sq} rx={r} fill="rgba(255,255,255,0.90)" />
      <rect x={gap * 2 + sq} y={gap} width={sq} height={sq} rx={r} fill="#e31e24" />
      <rect x={gap} y={gap * 2 + sq} width={sq} height={sq} rx={r} fill="rgba(255,255,255,0.45)" />
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
    // Mobile: w-64 full drawer | Desktop lg+: w-14 icon rail
    <aside className="w-64 lg:w-14 h-full min-h-screen flex flex-col select-none" style={{ backgroundColor: '#031d49' }}>

      {/* Header */}
      <div className="h-14 flex items-center shrink-0 px-4 lg:px-0 lg:justify-center"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Mobile: logo + texto */}
        <div className="flex items-center gap-3 flex-1 min-w-0 lg:hidden">
          <LogoMark size={32} />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-white tracking-wide leading-tight truncate">CÉSAR BRÍTEZ</p>
            <p className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#e31e24' }}>Aberturas</p>
          </div>
        </div>

        {/* Desktop: solo logo centrado */}
        <div className="hidden lg:flex items-center justify-center">
          <LogoMark size={30} />
        </div>

        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg ml-1"
            style={{ color: 'rgba(255,255,255,0.4)' }} aria-label="Cerrar menú">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-1' : ''}>

            {/* Separador de grupo */}
            {group.label && (
              <>
                {/* Mobile: texto de sección */}
                <p className="lg:hidden text-[10px] font-semibold uppercase tracking-widest px-4 pt-3 pb-1.5"
                  style={{ color: 'rgba(255,255,255,0.30)' }}>
                  {group.label}
                </p>
                {/* Desktop: línea separadora */}
                <div className="hidden lg:block h-px mx-2 mt-2 mb-1.5"
                  style={{ background: 'rgba(255,255,255,0.10)' }} />
              </>
            )}

            {group.items.map((item) => (
              <NavItemLink key={item.to} item={item} onClose={onClose} />
            ))}
          </div>
        ))}
      </nav>

      {/* Usuario */}
      <div className="shrink-0 p-2 lg:p-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Mobile: tarjeta completa */}
        <div className="lg:hidden flex items-center gap-2.5 p-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#e31e24' }}>
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
          <button onClick={handleSignOut} title="Cerrar sesión"
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            <LogOut size={14} />
          </button>
        </div>

        {/* Desktop: avatar centrado + logout, con tooltip */}
        <div className="hidden lg:flex flex-col items-center gap-1.5">
          {/* Avatar con tooltip */}
          <div className="relative group/user w-full flex justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center cursor-default"
              style={{ backgroundColor: '#e31e24' }}>
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <div className={cn(
              'absolute left-full top-1/2 -translate-y-1/2 ml-3',
              'bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg',
              'opacity-0 group-hover/user:opacity-100 transition-opacity duration-150',
              'pointer-events-none whitespace-nowrap shadow-xl z-[200]',
            )}>
              <p className="font-semibold">{user?.nombre ?? 'Usuario'}</p>
              <p className="capitalize opacity-60 text-[10px]">{user?.rol ?? ''}</p>
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
          </div>

          {/* Logout */}
          <button onClick={handleSignOut} title="Cerrar sesión"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
