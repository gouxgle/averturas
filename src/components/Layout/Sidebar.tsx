import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, Package,
  BarChart2, Settings, LogOut, LayoutGrid,
  FileText, Hammer, Layers, Boxes, TrendingUp,
  SlidersHorizontal, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  activeColor: string;
  activeBg: string;
  iconColor: string;
}

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        activeColor: 'text-blue-400',
        activeBg: 'bg-blue-500/10',
        iconColor: 'text-blue-400',
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      {
        to: '/presupuestos',
        label: 'Presupuestos',
        icon: FileText,
        activeColor: 'text-violet-400',
        activeBg: 'bg-violet-500/10',
        iconColor: 'text-violet-400',
      },
      {
        to: '/operaciones',
        label: 'Operaciones',
        icon: Hammer,
        activeColor: 'text-amber-400',
        activeBg: 'bg-amber-500/10',
        iconColor: 'text-amber-400',
      },
      {
        to: '/clientes',
        label: 'Clientes',
        icon: Users,
        activeColor: 'text-emerald-400',
        activeBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-400',
      },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      {
        to: '/productos',
        label: 'Productos',
        icon: Layers,
        activeColor: 'text-sky-400',
        activeBg: 'bg-sky-500/10',
        iconColor: 'text-sky-400',
      },
      {
        to: '/stock',
        label: 'Stock',
        icon: Boxes,
        activeColor: 'text-orange-400',
        activeBg: 'bg-orange-500/10',
        iconColor: 'text-orange-400',
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        to: '/reportes',
        label: 'Reportes',
        icon: TrendingUp,
        activeColor: 'text-purple-400',
        activeBg: 'bg-purple-500/10',
        iconColor: 'text-purple-400',
      },
      {
        to: '/configuracion',
        label: 'Configuración',
        icon: SlidersHorizontal,
        activeColor: 'text-slate-300',
        activeBg: 'bg-slate-500/10',
        iconColor: 'text-slate-400',
      },
    ],
  },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const initials = profile?.nombre
    ? profile.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col select-none">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
            <LayoutGrid size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-wide leading-tight">AVERTURAS</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Gestión</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-0.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
            {group.label && (
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 pb-1.5 pt-1">
                {group.label}
              </p>
            )}
            {group.items.map(({ to, label, icon: Icon, activeColor, activeBg, iconColor }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                    isActive
                      ? cn('text-white', activeBg)
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full', activeColor.replace('text-', 'bg-'))} />
                    )}
                    <span className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                      isActive ? cn('bg-slate-700/50', activeColor) : cn('text-slate-500 group-hover:text-slate-300')
                    )}>
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

      {/* User */}
      <div className="p-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {profile?.nombre ?? 'Usuario'}
            </p>
            <p className="text-[10px] text-slate-500 capitalize">{profile?.role ?? ''}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
