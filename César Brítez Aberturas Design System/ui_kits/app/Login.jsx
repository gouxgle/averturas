/* Login screen — split layout: navy panel left, form panel right.
   Mirrors src/pages/Login.tsx from the codebase. */

function Login({ onSignIn }) {
  const [email, setEmail] = React.useState('admin@aberturas.local');
  const [pwd, setPwd]     = React.useState('Admin1234!');
  const [loading, setLoading] = React.useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onSignIn({ nombre: 'César', rol: 'admin' }); }, 450);
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Brand panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: 320, flexShrink: 0, background: '#031d49', padding: 24,
      }}>
        <LogoMark size={72} variant="color" />
        <p style={{ marginTop: 20, fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>
          CÉSAR BRÍTEZ
        </p>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e31e24', marginTop: 4 }}>
          Aberturas
        </p>
        <p style={{ fontSize: 11, marginTop: 24, textAlign: 'center', padding: '0 24px', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
          Aberturas bien pensadas.
        </p>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div className="card" style={{ padding: 28, borderRadius: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1f2937' }}>Bienvenido</h2>
            <p style={{ margin: '4px 0 24px', fontSize: 13, color: '#6b7280' }}>
              Ingresá tus credenciales para continuar
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label className="field-label">Email</label>
                <input
                  className="input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} required autoFocus
                  placeholder="tu@email.com"
                />
              </div>
              <div className="field">
                <label className="field-label">Contraseña</label>
                <input
                  className="input" type="password" value={pwd}
                  onChange={e => setPwd(e.target.value)} required
                  placeholder="••••••••"
                />
              </div>
              <Button variant="brand" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', marginTop: 4 }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 22 }}>
            César Brítez Aberturas · Formosa Capital
          </p>
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
