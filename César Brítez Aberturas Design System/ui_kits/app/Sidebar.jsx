/* Sidebar — navy icon rail with section accents.
   Active item: vertical accent bar on the left + tinted bg + colored icon.
   Hover (idle): icon scales 1.10 with accent backing. */

const NAV_GROUPS = [
  { items: [
    { id: 'dashboard',    label: 'Dashboard',        icon: 'LayoutDashboard',    tone: 'blue'    },
  ]},
  { label: 'Comercial', items: [
    { id: 'crm',          label: 'CRM',              icon: 'GitBranch',          tone: 'rose'    },
    { id: 'presupuestos', label: 'Presupuestos',     icon: 'FileText',           tone: 'violet'  },
    { id: 'operaciones',  label: 'Operaciones',      icon: 'Hammer',             tone: 'amber'   },
    { id: 'remitos',      label: 'Remitos',          icon: 'Truck',              tone: 'teal'    },
    { id: 'pedidos',      label: 'Pedidos',          icon: 'ShoppingCart',       tone: 'lime'    },
    { id: 'recibos',      label: 'Recibos',          icon: 'Receipt',            tone: 'emerald' },
    { id: 'clientes',     label: 'Clientes',         icon: 'Users',              tone: 'cyan'    },
    { id: 'estado',       label: 'Estado de Cuenta', icon: 'BookOpen',           tone: 'indigo'  },
  ]},
  { label: 'Catálogo', items: [
    { id: 'productos',    label: 'Productos',        icon: 'Layers',             tone: 'sky'     },
    { id: 'stock',        label: 'Existencias',      icon: 'Boxes',              tone: 'orange'  },
    { id: 'proveedores',  label: 'Proveedores',      icon: 'Factory',            tone: 'amber'   },
  ]},
  { label: 'Sistema', items: [
    { id: 'reportes',     label: 'Reportes',         icon: 'TrendingUp',         tone: 'purple'  },
    { id: 'config',       label: 'Configuración',    icon: 'SlidersHorizontal',  tone: 'slate'   },
  ]},
];

const TONE_ACCENT = {
  blue:'#60a5fa', rose:'#fb7185', violet:'#a78bfa', amber:'#fbbf24',
  teal:'#2dd4bf', lime:'#a3e635', emerald:'#34d399', cyan:'#22d3ee',
  indigo:'#818cf8', sky:'#38bdf8', orange:'#fb923c', purple:'#c084fc',
  slate:'#cbd5e1',
};
const TONE_BG = {
  blue:'rgba(96,165,250,0.10)', rose:'rgba(251,113,133,0.10)', violet:'rgba(167,139,250,0.10)',
  amber:'rgba(251,191,36,0.10)', teal:'rgba(45,212,191,0.10)', lime:'rgba(163,230,53,0.10)',
  emerald:'rgba(52,211,153,0.10)', cyan:'rgba(34,211,238,0.10)', indigo:'rgba(129,140,248,0.10)',
  sky:'rgba(56,189,248,0.10)', orange:'rgba(251,146,60,0.10)', purple:'rgba(192,132,252,0.10)',
  slate:'rgba(148,163,184,0.10)',
};

function SidebarItem({ item, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  const [tipY, setTipY]   = React.useState(0);
  const btnRef            = React.useRef(null);
  const accent  = TONE_ACCENT[item.tone] || '#fff';
  const accentBg = TONE_BG[item.tone]   || 'rgba(255,255,255,0.05)';

  function handleEnter() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setTipY(r.top + r.height / 2);
    }
    setHover(true);
  }

  return (
    <div style={{ position: 'relative', padding: '0 6px', marginBottom: 2 }}>
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: 40, position: 'relative',
          borderRadius: 12,
          background: active ? accentBg : (hover ? 'rgba(255,255,255,0.05)' : 'transparent'),
          color: active ? accent : (hover ? accent : 'rgba(255,255,255,0.45)'),
          transition: 'all 150ms',
        }}
      >
        {active && (
          <span style={{
            position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
            width: 2, height: 18, background: accent, borderRadius: '0 4px 4px 0',
          }} />
        )}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(255,255,255,0.10)' : (hover ? accentBg : 'transparent'),
          color: 'inherit',
          transform: !active && hover ? 'scale(1.10)' : 'none',
          transition: 'transform 150ms',
        }}>
          <Icon name={item.icon} size={20} />
        </div>
      </button>

      {/* Tooltip — position:fixed so overflow:auto on <nav> doesn't clip it */}
      {hover && (
        <div style={{
          position: 'fixed', left: 62, top: tipY, transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', pointerEvents: 'none',
          whiteSpace: 'nowrap', zIndex: 9999,
        }}>
          <span style={{
            borderWidth: 5, borderStyle: 'solid',
            borderColor: 'transparent', borderRightColor: '#1a2744',
          }} />
          <span style={{
            background: '#1a2744', color: accent,
            fontSize: 11, fontWeight: 700, padding: '7px 12px',
            borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            letterSpacing: '0.01em',
          }}>{item.label}</span>
        </div>
      )}
    </div>
  );
}

function Sidebar({ active, onNavigate, user, onSignOut }) {
  const initials = user?.nombre
    ? user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'CB';
  const [logoutHover, setLogoutHover] = React.useState(false);

  return (
    <aside className="sidebar-rail" style={{
      width: 56, minHeight: '100vh', background: '#031d49',
      display: 'flex', flexDirection: 'column', userSelect: 'none',
      position: 'relative', zIndex: 30, flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <LogoMark size={30} variant="dark" />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', scrollbarWidth: 'none' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginTop: gi > 0 ? 4 : 0 }}>
            {group.label && (
              <div style={{ height: 1, background: 'rgba(255,255,255,0.10)', margin: '8px 8px 6px' }} />
            )}
            {group.items.map(item => (
              <SidebarItem
                key={item.id}
                item={item}
                active={item.id === active}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: '#e31e24',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 800,
        }}>{initials}</div>
        <button
          onClick={onSignOut}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          title="Cerrar sesión"
          style={{
            width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: logoutHover ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
            background: logoutHover ? 'rgba(255,255,255,0.08)' : 'transparent',
            transition: 'all 150ms',
          }}
        >
          <Icon name="LogOut" size={18} />
        </button>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
