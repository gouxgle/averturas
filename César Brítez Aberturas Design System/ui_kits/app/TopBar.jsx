/* Top bar — navy header with prominent brand identity.
   Shows a hamburger button on mobile (hidden on desktop via CSS). */

function TopBar({ notifCount = 0, onBellClick, bellOpen, onMenuClick }) {
  return (
    <header style={{
      height: 72, background: '#031d49',
      display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14,
      boxShadow: '0 2px 14px rgba(3,29,73,0.30)',
      position: 'relative', zIndex: 20,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Hamburger — only visible on mobile via CSS */}
      <button
        className="mob-hamburger"
        onClick={onMenuClick}
        style={{
          display: 'none',   /* CSS .mob-hamburger overrides to flex on mobile */
          width: 36, height: 36, borderRadius: 10,
          alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.75)', flexShrink: 0,
        }}
      >
        <Icon name="Menu" size={20} />
      </button>

      {/* Brand cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LogoMark size={28} variant="dark" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            CÉSAR BRÍTEZ
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#e31e24', letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: 2 }}>
            Aberturas
          </span>
        </div>
      </div>

      {/* Slogan — hidden on mobile via CSS .topbar-slogan */}
      <div className="topbar-slogan" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ height: 32, width: 1, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Aberturas bien pensadas.
        </span>
      </div>

      {/* Spacer on mobile (when slogan hidden) */}
      <div style={{ flex: 1 }} aria-hidden="true" />

      {/* Notification bell */}
      <button
        onClick={onBellClick}
        title="Notificaciones"
        style={{
          width: 40, height: 40, borderRadius: 12, position: 'relative', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: notifCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.55)',
          background: bellOpen ? 'rgba(255,255,255,0.10)' : 'transparent',
          transition: 'all 150ms',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
        onMouseLeave={e => e.currentTarget.style.background = bellOpen ? 'rgba(255,255,255,0.10)' : 'transparent'}
      >
        <Icon name="Bell" size={20} />
        {notifCount > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            minWidth: 16, height: 16, padding: '0 4px',
            background: '#e31e24', color: '#fff', fontSize: 9, fontWeight: 800,
            borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #031d49',
          }}>{notifCount > 9 ? '9+' : notifCount}</span>
        )}
      </button>
    </header>
  );
}

function NotificationPanel({ notifs, onClose, onSelect, onMarkRead }) {
  return (
    <div style={{
      position: 'absolute', right: 14, top: 72, marginTop: 6, zIndex: 100,
      width: 320, background: '#0a2761',
      border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 8px 32px -8px rgba(0,0,0,0.30)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 12, fontWeight: 700 }}>
          <Icon name="Bell" size={14} color="#fbbf24" />
          Notificaciones
          {notifs.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 600, color: '#fcd34d', background: 'rgba(251,191,36,0.10)', padding: '2px 7px', borderRadius: 9999 }}>
              {notifs.length} nueva{notifs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {notifs.length > 0 && (
            <button onClick={onMarkRead} style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', padding: '4px 8px', borderRadius: 8 }}>
              Marcar leídas
            </button>
          )}
          <button onClick={onClose} style={{ padding: 4, borderRadius: 6, color: 'rgba(255,255,255,0.40)' }}>
            <Icon name="X" size={13} />
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <Icon name="CheckCircle2" size={24} color="rgba(16,185,129,0.60)" />
            <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, marginTop: 8 }}>Sin notificaciones pendientes</p>
          </div>
        ) : notifs.map(n => (
          <button key={n.id} onClick={() => onSelect && onSelect(n)}
            style={{ width: '100%', display: 'flex', gap: 10, padding: '12px 16px', textAlign: 'left', transition: 'background 150ms', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'rgba(34,197,94,0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="CheckCircle2" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, color: '#fff', fontSize: 12, fontWeight: 600 }}>{n.cliente}</p>
              <small style={{ display: 'block', color: 'rgba(255,255,255,0.50)', fontSize: 11, marginTop: 2 }}>
                Aprobó el presupuesto <span style={{ fontFamily: 'monospace', color: '#34d399', fontWeight: 700 }}>{n.numero}</span>
              </small>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ color: '#34d399', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(n.monto)}</span>
                <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10 }}>{n.when}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, NotificationPanel });
