import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ReceiptText, Plus, Files, Hourglass, AlertTriangle, PowerOff, ShieldAlert, BookOpenCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import { HelpButton } from '@/components/HelpButton';
import { fmt$, type Tablero } from './tipos';
import { TabComprobantes } from './TabComprobantes';
import { TabPorFacturar } from './TabPorFacturar';
import { TabContingencia } from './TabContingencia';
import { TabLibroIva } from './TabLibroIva';
import { DetalleComprobante } from './DetalleComprobante';

type Tab = 'comprobantes' | 'por-facturar' | 'contingencia' | 'libro-iva';

// Facturación electrónica: comprobantes emitidos con ARCA y lo que falta facturar. El detalle
// se abre por query param (?cbte=) para poder linkearlo desde recibos y presupuestos.
export default function Facturacion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'comprobantes';
  const cbteId = params.get('cbte');
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [refresh, setRefresh] = useState(0);
  const puedeEmitir = user?.rol === 'admin' || user?.rol === 'vendedor';

  useEffect(() => {
    api.get<Tablero>('/facturacion/tablero').then(setTablero).catch(() => {});
  }, [refresh]);

  const recargar = useCallback(() => setRefresh(r => r + 1), []);
  const setTab = (t: Tab) => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); };
  const abrir = (id: string) => { const p = new URLSearchParams(params); p.set('cbte', id); setParams(p); };
  const cerrar = () => { const p = new URLSearchParams(params); p.delete('cbte'); setParams(p, { replace: true }); };

  const t = tablero;
  const TABS: { value: Tab; label: string; icon: typeof Files; count?: number }[] = [
    { value: 'comprobantes', label: 'Comprobantes', icon: Files },
    { value: 'por-facturar', label: 'Por facturar', icon: Hourglass },
    { value: 'libro-iva',    label: 'Libro IVA',    icon: BookOpenCheck },
    { value: 'contingencia', label: 'Contingencia', icon: ShieldAlert, count: t?.en_contingencia || undefined },
  ];

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section="facturacion">
      <SectionHero
        section="facturacion"
        icon={ReceiptText}
        title="Facturación"
        sub="Facturas y notas de crédito electrónicas con ARCA"
        actions={<>
          <HelpButton topic="facturacion" />
          {puedeEmitir && (
            <button onClick={() => navigate('/facturacion/nueva')}
              className="flex items-center gap-2 bg-fuchsia-700 text-white text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-fuchsia-800 transition-colors shadow-md">
              <Plus size={16} /> Nueva factura
            </button>
          )}
        </>}
      />

      {t && !t.habilitada && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 items-start">
          <PowerOff size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            <b>La facturación todavía no está habilitada.</b> Podés preparar y guardar borradores; para emitir hay que
            completar la puesta en marcha con ARCA{user?.rol === 'admin'
              ? <> en <Link to="/configuracion" className="underline font-semibold">Configuración &gt; Facturación con ARCA</Link>.</>
              : ' (la hace un administrador).'}
          </p>
        </div>
      )}
      {t && t.sin_confirmar > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3 items-start">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            <b>{t.sin_confirmar} comprobante{t.sin_confirmar === 1 ? '' : 's'} sin confirmar por ARCA.</b> El sistema lo
            verifica solo cada pocos minutos. <b>No los vuelvas a emitir</b>: se podrían duplicar.
          </p>
        </div>
      )}

      {t && (
        <CompactStatsBar items={[
          { value: fmt$(t.facturado_mes).replace(/,\d{2}$/, ''), label: 'facturado este mes', color: '#f0abfc' },
          { value: t.facturas_a_mes, label: 'facturas A', color: '#ffffff' },
          { value: t.facturas_b_mes, label: 'facturas B', color: '#ffffff' },
          { value: t.notas_credito_mes, label: 'notas de crédito', color: '#fbbf24' },
          { value: t.pendientes, label: 'borradores', color: t.pendientes ? '#fbbf24' : '#ffffff' },
          { value: t.sin_confirmar, label: 'sin confirmar', color: t.sin_confirmar ? '#f87171' : '#ffffff' },
        ]} />
      )}

      <div className="flex gap-1 flex-wrap">
        {TABS.map(x => (
          <button key={x.value} onClick={() => setTab(x.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              tab === x.value
                ? 'bg-fuchsia-700 text-white border-fuchsia-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-fuchsia-400 hover:text-fuchsia-700',
            )}>
            <x.icon size={14} /> {x.label}
            {x.count !== undefined && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', tab === x.value ? 'bg-white/20' : 'bg-sky-100 text-sky-800')}>{x.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'comprobantes' && <TabComprobantes abrir={abrir} refresh={refresh} />}
      {tab === 'por-facturar' && <TabPorFacturar puedeEmitir={puedeEmitir} refresh={refresh} />}
      {tab === 'libro-iva' && <TabLibroIva puedeEmitir={puedeEmitir} abrir={abrir} />}
      {tab === 'contingencia' && <TabContingencia puedeEmitir={puedeEmitir} abrir={abrir} refresh={refresh} onChanged={recargar} />}

      {cbteId && <DetalleComprobante id={cbteId} onClose={cerrar} onChanged={recargar} puedeEmitir={puedeEmitir} />}
    </div>
  );
}
