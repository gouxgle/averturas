/* App shell — router + mobile nav + drawer. */

const MOB_NAV = [
  { id: 'dashboard',    icon: 'LayoutDashboard', label: 'Inicio'    },
  { id: 'operaciones',  icon: 'Hammer',          label: 'Ops'       },
  { id: 'presupuestos', icon: 'FileText',         label: 'Presup.'   },
  { id: 'clientes',     icon: 'Users',            label: 'Clientes'  },
  { id: 'menu',         icon: 'Menu',             label: 'Más'       },
];

function MobileDrawer({ active, onNavigate, user, onSignOut, onClose }) {
  return (
    <div className="mob-drawer-overlay open" onClick={onClose}>
      <div className="mob-drawer-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoMark size={32} variant="dark" />
              <div>
                <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.04em' }}>CÉSAR BRÍTEZ</p>
                <p style={{ margin: 0, color: '#e31e24', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Aberturas</p>
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.50)', padding: 4 }}>
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        {/* Nav groups — full labels visible in drawer */}
        <nav style={{ padding: '8px 8px', overflowY: 'auto' }}>
          {[
            { label: null, items: [{ id:'dashboard', icon:'LayoutDashboard', label:'Dashboard', tone:'blue' }] },
            { label: 'Comercial', items: [
              { id:'crm',          icon:'GitBranch',         label:'CRM',              tone:'rose'    },
              { id:'presupuestos', icon:'FileText',          label:'Presupuestos',     tone:'violet'  },
              { id:'operaciones',  icon:'Hammer',            label:'Operaciones',      tone:'amber'   },
              { id:'remitos',      icon:'Truck',             label:'Remitos',          tone:'teal'    },
              { id:'pedidos',      icon:'ShoppingCart',      label:'Pedidos',          tone:'lime'    },
              { id:'recibos',      icon:'Receipt',           label:'Recibos',          tone:'emerald' },
              { id:'clientes',     icon:'Users',             label:'Clientes',         tone:'cyan'    },
              { id:'estado',       icon:'BookOpen',          label:'Estado de Cuenta', tone:'indigo'  },
            ]},
            { label: 'Catálogo', items: [
              { id:'productos',    icon:'Layers',            label:'Productos',        tone:'sky'     },
              { id:'stock',        icon:'Boxes',             label:'Existencias',      tone:'orange'  },
              { id:'proveedores',  icon:'Factory',           label:'Proveedores',      tone:'amber'   },
            ]},
            { label: 'Sistema', items: [
              { id:'reportes',     icon:'TrendingUp',        label:'Reportes',         tone:'purple'  },
              { id:'config',       icon:'SlidersHorizontal', label:'Configuración',    tone:'slate'   },
            ]},
          ].map((group, gi) => (
            <div key={gi} style={{ marginTop: gi > 0 ? 4 : 0 }}>
              {group.label && (
                <p style={{ margin: '10px 8px 4px', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{group.label}</p>
              )}
              {group.items.map(item => {
                const isActive = item.id === active;
                return (
                  <button key={item.id}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 10px', borderRadius: 10,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.60)',
                      background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                      fontWeight: isActive ? 700 : 500, fontSize: 13,
                      transition: 'all 150ms',
                    }}
                  >
                    <IconTile name={item.icon} tone={item.tone} size="sm" />
                    {item.label}
                    {isActive && <Icon name="ChevronRight" size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e31e24', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>
            {user?.nombre?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CB'}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, color: '#fff', fontSize: 12, fontWeight: 600 }}>{user?.nombre || 'Usuario'}</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.40)', fontSize: 11 }}>{user?.rol || 'admin'}</p>
          </div>
          <button onClick={onSignOut} style={{ color: 'rgba(255,255,255,0.40)', padding: 4 }} title="Cerrar sesión">
            <Icon name="LogOut" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav({ active, onNavigate, notifCount, onBellClick }) {
  return (
    <nav className="mob-bottom-nav">
      {MOB_NAV.map(item => {
        const isActive = item.id !== 'menu' && item.id === active;
        return (
          <button key={item.id}
            className={'mob-nav-item' + (isActive ? ' active' : '')}
            onClick={() => item.id === 'menu' ? onBellClick() : onNavigate(item.id)}
          >
            <div style={{ position: 'relative' }}>
              <Icon name={item.id === 'menu' ? (notifCount > 0 ? 'Bell' : 'Menu') : item.icon} size={20} />
              {item.id === 'menu' && notifCount > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -5, width: 8, height: 8, background: '#e31e24', borderRadius: '50%', border: '1.5px solid #031d49' }} />
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function App() {
  const [user, setUser]           = React.useState(null);
  const [active, setActive]       = React.useState('dashboard');
  const [bellOpen, setBellOpen]   = React.useState(false);
  const [drawerOpen, setDrawer]   = React.useState(false);
  const [notifs, setNotifs]       = React.useState([
    { id: 'n1', cliente: 'Familia González', numero: 'PR-0042', monto: 1250000, when: 'Hace 12 min' },
    { id: 'n2', cliente: 'Mariela Ojeda',    numero: 'PR-0039', monto:  480000, when: 'Hace 2 h'   },
  ]);

  if (!user) return <Login onSignIn={setUser} />;

  function navigate(id) { setActive(id); setBellOpen(false); setDrawer(false); }
  function signOut()     { setUser(null); setActive('dashboard'); }
  function markRead()    { setNotifs([]); }

  let screen;
  switch (active) {
    case 'dashboard':    screen = <Dashboard    user={user} onNavigate={navigate} />; break;
    case 'operaciones':  screen = <Operaciones  onSelectOp={() => navigate('presupuestos')} />; break;
    case 'presupuestos': screen = <Presupuestos onOpen={() => {}} />; break;
    case 'crm':          screen = <CRM />; break;
    case 'remitos':      screen = <Remitos />; break;
    case 'pedidos':      screen = <Pedidos />; break;
    case 'recibos':      screen = <Recibos />; break;
    case 'clientes':     screen = <Clientes />; break;
    case 'estado':       screen = <Placeholder section="estado"       icon="BookOpen"          title="Estado de Cuenta"  sub="Cuenta corriente por cliente"             breadcrumb={['Comercial','Estado de Cuenta']} />; break;
    case 'productos':    screen = <Placeholder section="productos"    icon="Layers"            title="Productos"         sub="Catálogo de aberturas"                    breadcrumb={['Catálogo','Productos']} />; break;
    case 'stock':        screen = <Placeholder section="stock"        icon="Boxes"             title="Existencias"       sub="Inventario y movimientos de stock"         breadcrumb={['Catálogo','Existencias']} />; break;
    case 'proveedores':  screen = <Placeholder section="proveedores"  icon="Factory"           title="Proveedores"       sub="Fabricantes y revendedores"               breadcrumb={['Catálogo','Proveedores']} />; break;
    case 'reportes':     screen = <Placeholder section="reportes"     icon="TrendingUp"        title="Reportes"          sub="Ventas, conversión, productos"            breadcrumb={['Sistema','Reportes']} />; break;
    case 'config':       screen = <Placeholder section="config"       icon="SlidersHorizontal" title="Configuración"     sub="Empresa, usuarios y catálogos"            breadcrumb={['Sistema','Configuración']} />; break;
    default: screen = null;
  }

  return (
    <div className="app-shell">
      <Watermark />
      <Sidebar active={active} onNavigate={navigate} user={user} onSignOut={signOut} />
      <div className="app-main">
        <TopBar
          notifCount={notifs.length}
          onBellClick={() => setBellOpen(v => !v)}
          bellOpen={bellOpen}
          onMenuClick={() => setDrawer(true)}
        />
        {bellOpen && (
          <NotificationPanel
            notifs={notifs}
            onClose={() => setBellOpen(false)}
            onSelect={() => { setBellOpen(false); navigate('presupuestos'); }}
            onMarkRead={markRead}
          />
        )}
        <main className="app-page" data-section={active}>
          {screen}
        </main>
        <MobileBottomNav
          active={active}
          onNavigate={navigate}
          notifCount={notifs.length}
          onBellClick={() => setBellOpen(v => !v)}
        />
      </div>
      {drawerOpen && (
        <MobileDrawer
          active={active}
          onNavigate={navigate}
          user={user}
          onSignOut={signOut}
          onClose={() => setDrawer(false)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
