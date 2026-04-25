import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// Logo mark: 2×2 cuadros en colores de marca (versión fondo claro)
function LogoMarkColor({ size = 56 }: { size?: number }) {
  const gap = Math.round(size * 0.083);
  const sq  = Math.round((size - gap * 3) / 2);
  const r   = Math.round(sq * 0.22);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <rect x={gap} y={gap} width={sq} height={sq} rx={r} fill="#031d49" />
      <rect x={gap * 2 + sq} y={gap} width={sq} height={sq} rx={r} fill="#e31e24" />
      <rect x={gap} y={gap * 2 + sq} width={sq} height={sq} rx={r} fill="#fcfcfc" stroke="#d1d5db" strokeWidth="1" />
      <rect x={gap * 2 + sq} y={gap * 2 + sq} width={sq} height={sq} rx={r} fill="#000000" />
    </svg>
  );
}

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError('Email o contraseña incorrectos');
    } else {
      navigate('/');
    }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none transition-all';

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f0f2f5' }}>

      {/* Panel lateral decorativo (visible en md+) */}
      <div className="hidden md:flex flex-col items-center justify-center w-80 shrink-0"
        style={{ backgroundColor: '#031d49' }}>
        <LogoMarkColor size={72} />
        <p className="mt-5 text-xl font-extrabold text-white tracking-wide">CÉSAR BRÍTEZ</p>
        <p className="text-sm font-medium tracking-widest uppercase mt-1" style={{ color: '#e31e24' }}>
          Aberturas
        </p>
        <p className="text-xs mt-6 text-center px-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Aberturas bien pensadas.
        </p>
      </div>

      {/* Panel login */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Logo visible solo en mobile */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <LogoMarkColor size={56} />
            <p className="mt-3 text-lg font-extrabold tracking-wide" style={{ color: '#031d49' }}>
              CÉSAR BRÍTEZ
            </p>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#e31e24' }}>
              Aberturas
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Bienvenido</h2>
            <p className="text-sm text-gray-500 mb-6">Ingresá tus credenciales para continuar</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className={inputCls}
                  style={{ '--tw-ring-color': '#031d49' } as React.CSSProperties}
                  onFocus={e => (e.target.style.borderColor = '#031d49')}
                  onBlur={e => (e.target.style.borderColor = '')}
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={inputCls}
                  onFocus={e => (e.target.style.borderColor = '#031d49')}
                  onBlur={e => (e.target.style.borderColor = '')}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-opacity mt-2"
                style={{ backgroundColor: '#031d49' }}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-6">
            César Brítez Aberturas · Formosa Capital
          </p>
        </div>
      </div>
    </div>
  );
}
