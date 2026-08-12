import { useState, useEffect, useCallback, forwardRef } from 'react';
import { Target, Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { OportunidadCard } from './OportunidadCard';
import { ModalOportunidad } from './ModalOportunidad';
import type { Oportunidad } from './types';

type Vista = 'vencidas' | 'hoy' | 'proximas' | 'a_definir' | 'todas';

interface Resumen { vencidas: number; hoy: number; semana: number; abiertas: number; a_definir: number }

const TABS: { key: Vista; label: (r: Resumen | null) => string }[] = [
  { key: 'vencidas',  label: r => `Vencidas${r ? ` (${r.vencidas})` : ''}` },
  { key: 'hoy',       label: r => `Hoy${r ? ` (${r.hoy})` : ''}` },
  { key: 'proximas',  label: () => 'Próximas' },
  { key: 'a_definir', label: r => `A definir${r ? ` (${r.a_definir})` : ''}` },
  { key: 'todas',     label: () => 'Todas' },
];

// Sección de Oportunidades futuras dentro del CRM — clientes con intención de
// compra postergada ("el año que viene cambio las ventanas"). El resaltado
// temporal (prop `resaltado`) lo dispara CRM.tsx cuando se llega acá desde
// un ?foco=oportunidades (Dashboard, campanita).
export const PanelOportunidades = forwardRef<HTMLDivElement, { resaltado?: boolean }>(
  function PanelOportunidades({ resaltado }, ref) {
    const [vista, setVista] = useState<Vista>('vencidas');
    const [items, setItems] = useState<Oportunidad[]>([]);
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAlta, setShowAlta] = useState(false);
    const [editando, setEditando] = useState<Oportunidad | null>(null);

    const cargarResumen = useCallback(async () => {
      try { setResumen(await api.get<Resumen>('/oportunidades/resumen')); } catch { /* silencioso */ }
    }, []);

    const cargarLista = useCallback(async (v: Vista) => {
      setLoading(true);
      try {
        const rows = await api.get<Oportunidad[]>(`/oportunidades?vista=${v}`);
        setItems(rows);
      } catch { /* silencioso */ }
      finally { setLoading(false); }
    }, []);

    useEffect(() => { cargarResumen(); }, [cargarResumen]);
    useEffect(() => { cargarLista(vista); }, [vista, cargarLista]);

    // Al pasar a "hoy" una vencida (deja de pertenecer a la vista actual) o
    // cerrar/posponer una, la sacamos de la lista local y refrescamos los
    // contadores — sin esperar un refetch completo.
    function onUpdate(actualizada: Oportunidad) {
      setItems(prev => {
        const siguePerteneciendo =
          (vista === 'vencidas' && actualizada.estado === 'pendiente' && (actualizada.dias_atraso ?? 0) > 0) ||
          (vista === 'hoy' && actualizada.estado === 'pendiente' && (actualizada.dias_atraso ?? 0) === 0) ||
          (vista === 'proximas' && actualizada.estado === 'pendiente' && (actualizada.dias_atraso ?? 0) < 0) ||
          (vista === 'a_definir' && actualizada.estado === 'contactada') ||
          (vista === 'todas');
        if (!siguePerteneciendo) return prev.filter(o => o.id !== actualizada.id);
        return prev.map(o => o.id === actualizada.id ? { ...o, ...actualizada, cliente: o.cliente } : o);
      });
      cargarResumen();
    }

    function onAltaExitosa(nueva: Oportunidad) {
      cargarResumen();
      cargarLista(vista);
      void nueva;
    }

    function onEdicionExitosa(actualizada: Oportunidad) {
      onUpdate(actualizada);
      setEditando(null);
    }

    return (
      <div ref={ref} className={cn(
        'bg-white rounded-2xl border shadow-md overflow-hidden transition-shadow',
        resaltado ? 'ring-2 ring-fuchsia-400 border-fuchsia-300' : 'border-gray-200'
      )}>
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-fuchsia-500" />
            <span className="text-sm font-bold text-gray-800">Oportunidades futuras</span>
            {resumen && resumen.vencidas > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                {resumen.vencidas} vencida{resumen.vencidas !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button onClick={() => setShowAlta(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold transition-colors">
            <Plus size={13} /> Nueva oportunidad
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setVista(t.key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap',
                vista === t.key ? 'bg-fuchsia-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-fuchsia-300'
              )}>
              {t.label(resumen)}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin text-gray-600" /></div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <Target size={24} className="mx-auto mb-2 text-gray-200" />
              <p className="text-xs text-gray-600">
                {vista === 'vencidas' ? 'Sin oportunidades vencidas' : 'No hay oportunidades en esta vista'}
              </p>
            </div>
          ) : items.map(o => (
            <OportunidadCard key={o.id} oportunidad={o} onUpdate={onUpdate} onEdit={setEditando} />
          ))}
        </div>

        {showAlta && (
          <ModalOportunidad origen="crm" onClose={() => setShowAlta(false)} onSuccess={onAltaExitosa} />
        )}
        {editando && (
          <ModalOportunidad oportunidad={editando} onClose={() => setEditando(null)} onSuccess={onEdicionExitosa} />
        )}
      </div>
    );
  }
);
