import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';

/** Marca de agua: el isologotipo 2×2 a muy baja opacidad */
function Watermark() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden style={{ zIndex: 0 }}>

      {/* Patrón de cuadrícula — evoca marco de ventana */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent 0, transparent 149px,
              rgba(3,29,73,0.022) 149px, rgba(3,29,73,0.022) 150px
            ),
            repeating-linear-gradient(
              0deg,
              transparent 0, transparent 149px,
              rgba(3,29,73,0.022) 149px, rgba(3,29,73,0.022) 150px
            )
          `,
        }}
      />

      {/* Logo principal — grande, derecha inferior */}
      <svg
        viewBox="0 0 200 200"
        fill="none"
        style={{
          position: 'absolute',
          right: '4%',
          bottom: '-8%',
          width: 520,
          height: 520,
          opacity: 0.032,
          transform: 'rotate(-6deg)',
        }}
      >
        <rect x="8"   y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="8"   y="108" width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="108" width="84" height="84" rx="14" fill="#031d49" />
      </svg>

      {/* Logo secundario — pequeño, arriba izquierda (zona de contenido) */}
      <svg
        viewBox="0 0 200 200"
        fill="none"
        style={{
          position: 'absolute',
          left: '18%',
          top: '8%',
          width: 180,
          height: 180,
          opacity: 0.018,
          transform: 'rotate(12deg)',
        }}
      >
        <rect x="8"   y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="8"   y="108" width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="108" width="84" height="84" rx="14" fill="#031d49" />
      </svg>

      {/* Acento de color — punto rojo sutil */}
      <div
        style={{
          position: 'absolute',
          right: '12%',
          top: '20%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(227,30,36,0.04) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--app-bg)', position: 'relative' }}>

      <Watermark />

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden"
          style={{ zIndex: 20 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          'fixed inset-y-0 left-0 transition-transform duration-300',
          'lg:static lg:translate-x-0 lg:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ zIndex: 30 }}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0" style={{ position: 'relative', zIndex: 1 }}>

        {/* Top bar — solo mobile */}
        <header
          className="lg:hidden h-14 flex items-center px-4 gap-3 shrink-0"
          style={{
            background: '#031d49',
            boxShadow: '0 2px 12px rgba(3,29,73,0.25)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            {/* Logo mark mini */}
            <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
              <rect x="8"   y="8"   width="84" height="84" rx="12" fill="rgba(255,255,255,0.90)" />
              <rect x="108" y="8"   width="84" height="84" rx="12" fill="#e31e24" />
              <rect x="8"   y="108" width="84" height="84" rx="12" fill="rgba(255,255,255,0.45)" />
              <rect x="108" y="108" width="84" height="84" rx="12" fill="rgba(255,255,255,0.20)" />
            </svg>
            <div>
              <span className="text-sm font-extrabold text-white tracking-wide">CÉSAR BRÍTEZ</span>
              <span className="ml-2 text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#e31e24' }}>Aberturas</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: {
            borderRadius: '14px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
