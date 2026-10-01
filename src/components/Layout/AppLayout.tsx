import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { scrollContenidoArriba } from '@/lib/scroll';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { NotificationBell } from '@/components/NotificationBell';
import { AvisosEmergentes } from '@/components/AvisosEmergentes';
import { BuzonComentarios } from '@/components/BuzonComentarios';
import { AgendaDelDia } from '@/components/agenda/AgendaDelDia';
import { BotonAgenda } from '@/components/agenda/BotonAgenda';

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
              rgba(3,29,73,0.038) 149px, rgba(3,29,73,0.038) 150px
            ),
            repeating-linear-gradient(
              0deg,
              transparent 0, transparent 149px,
              rgba(3,29,73,0.038) 149px, rgba(3,29,73,0.038) 150px
            )
          `,
        }}
      />

      {/* Logo principal — centrado-derecha, tamaño contenido */}
      <svg
        viewBox="0 0 200 200"
        fill="none"
        style={{
          position: 'absolute',
          right: '6%',
          bottom: '8%',
          width: 340,
          height: 340,
          opacity: 0.072,
          filter: 'blur(0.5px)',
        }}
      >
        <rect x="8"   y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="8"   y="108" width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="108" width="84" height="84" rx="14" fill="#031d49" />
      </svg>

      {/* Logo secundario — arriba izquierda zona contenido */}
      <svg
        viewBox="0 0 200 200"
        fill="none"
        style={{
          position: 'absolute',
          left: '20%',
          top: '12%',
          width: 140,
          height: 140,
          opacity: 0.038,
          filter: 'blur(0.4px)',
        }}
      >
        <rect x="8"   y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="8"   width="84" height="84" rx="14" fill="#031d49" />
        <rect x="8"   y="108" width="84" height="84" rx="14" fill="#031d49" />
        <rect x="108" y="108" width="84" height="84" rx="14" fill="#031d49" />
      </svg>

      {/* Acento rojo — mancha difusa detrás del logo principal */}
      <div
        style={{
          position: 'absolute',
          right: '3%',
          bottom: '5%',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(227,30,36,0.055) 0%, transparent 65%)',
        }}
      />
    </div>
  );
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Cada pantalla nueva arranca arriba: en una SPA el navegador no resetea el scroll al
  // navegar, y la pantalla nueva abría a la altura que traía la anterior. Solo con el
  // pathname: pestañas y modales por query param (?tab=, ?oc=) conservan la posición.
  useEffect(() => {
    scrollContenidoArriba();
  }, [pathname]);

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
          'lg:static lg:transform-none lg:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ zIndex: 30 }}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0" style={{ position: 'relative', zIndex: 1 }}>

        {/* Top bar — hamburger (mobile) + logo centrado + bell */}
        <header
          className="h-14 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 shrink-0"
          style={{
            background: '#031d49',
            boxShadow: '0 2px 12px rgba(3,29,73,0.25)',
          }}
        >
          {/* Hamburger — solo mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          {/* Agenda del día: cuántas tareas quedan hoy (a la izquierda: a la derecha está el
              badge TEST/PRODUCCIÓN de EntornoBanner, junto a la campanita) */}
          <BotonAgenda />

          {/* Logo — ícono + texto, centrado, tipografía de marca */}
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2 sm:gap-3">
            <svg viewBox="0 0 200 200" fill="none" className="shrink-0 w-7 h-7 sm:w-9 sm:h-9">
              <rect x="8"   y="8"   width="84" height="84" rx="12" fill="rgba(255,255,255,0.90)" />
              <rect x="108" y="8"   width="84" height="84" rx="12" fill="#e31e24" />
              <rect x="8"   y="108" width="84" height="84" rx="12" fill="rgba(255,255,255,0.45)" />
              <rect x="108" y="108" width="84" height="84" rx="12" fill="rgba(255,255,255,0.20)" />
            </svg>
            <div className="flex items-baseline gap-2.5 flex-wrap justify-center">
              <span
                className="text-white text-lg min-[400px]:text-xl sm:text-2xl tracking-wide whitespace-nowrap"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800 }}
              >
                CÉSAR BRÍTEZ
              </span>
              <span
                className="text-sm sm:text-base"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic', color: 'rgba(255,255,255,0.75)' }}
              >
                Aberturas bien pensadas
              </span>
            </div>
          </div>

          {/* Bell — siempre visible, en área de contenido (sin problemas de overflow) */}
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--app-bg)' }}>
          <Outlet />
        </main>
      </div>

      <BuzonComentarios />

      {/* Agenda del día: aviso al entrar y recordatorios de lo pendiente (no bloquea) */}
      <AgendaDelDia />

      {/* Avisos que se quedan hasta que se los acepta (no bloquean la pantalla) */}
      <AvisosEmergentes />

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
