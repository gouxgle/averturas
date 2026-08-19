import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface Corrida { fecha: string; exitoso: boolean; archivo: string | null; error: string | null }
interface BackupsResumen {
  disponible: boolean;
  corridas: Corrida[];
  resumen: { dias_desde_ultimo_exitoso: number | null };
}

// Alerta silenciosa (no renderiza nada si está todo bien) para que una falla de
// backup no vuelva a pasar 13 días desapercibida como la de rclone/Google Drive
// de agosto 2026 — el backend ya calculaba bien dias_desde_ultimo_exitoso
// (GET /backups), pero nadie lo miraba salvo que sospechara algo. Solo admin,
// porque GET /backups ya es admin-only del lado del servidor.
const UMBRAL_DIAS = 2;

export function AlertaBackups() {
  const { user } = useAuth();
  const [data, setData] = useState<BackupsResumen | null>(null);

  useEffect(() => {
    if (user?.rol !== 'admin') return;
    api.get<BackupsResumen>('/backups').then(setData).catch(() => {});
  }, [user?.rol]);

  if (user?.rol !== 'admin' || !data?.disponible) return null;

  const dias = data.resumen.dias_desde_ultimo_exitoso;
  const sinFallas = dias !== null && dias < UMBRAL_DIAS;
  if (sinFallas) return null;

  const ultimaCorrida = data.corridas[0];
  const detalleError = ultimaCorrida && !ultimaCorrida.exitoso ? ultimaCorrida.error : null;

  return (
    <div className="mb-5 rounded-2xl border-2 border-red-300 shadow-xl overflow-hidden">
      <div className="px-5 py-3 flex items-center gap-2.5"
        style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)' }}>
        <AlertOctagon size={18} className="text-white shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-extrabold text-white">
            {dias === null ? 'Nunca se registró un backup exitoso' : `Los backups fallan hace ${dias} día${dias !== 1 ? 's' : ''}`}
          </h2>
          {detalleError && (
            <p className="text-[11px] text-red-100 truncate mt-0.5" title={detalleError}>{detalleError}</p>
          )}
        </div>
        <Link to="/configuracion"
          className="shrink-0 text-xs font-bold text-red-700 bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
          Ver en Configuración
        </Link>
      </div>
    </div>
  );
}
