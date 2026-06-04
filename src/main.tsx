import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // Captura el 100% de errores, 10% de trazas de performance
  tracesSampleRate: 0.1,
  // No enviar en desarrollo local
  enabled: import.meta.env.PROD,
  beforeSend(event) {
    // No enviar errores de red (offline, CORS, etc.)
    if (event.exception?.values?.[0]?.type === 'NetworkError') return null;
    return event;
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui', backgroundColor: '#f9fafb',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 8 }}>
              Algo salió mal
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
              El error fue registrado automáticamente. Podés intentar recargar la página.
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 24, fontFamily: 'monospace' }}>
              {String(error).slice(0, 120)}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={resetError}
                style={{ padding: '8px 20px', background: '#031d49', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Reintentar
              </button>
              <button onClick={() => window.location.reload()}
                style={{ padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
                Recargar
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
