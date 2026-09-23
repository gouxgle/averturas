import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Plus, ClipboardList, Scale, PackageCheck, Zap, Layers, Truck, AlertTriangle, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionHero } from '@/components/SectionHero';
import { CompactStatsBar } from '@/components/CompactStatsBar';
import { HelpButton } from '@/components/HelpButton';
import { fmtMoneda, type TableroCompras } from './tipos';
import { TabSolicitudes } from './TabSolicitudes';
import { TabCotizaciones } from './TabCotizaciones';
import { TabOrdenes } from './TabOrdenes';
import { TabRecepciones } from './TabRecepciones';
import { TabReclamos } from './TabReclamos';
import { TabCuentaCorriente } from './TabCuentaCorriente';
import { DetalleSolicitud } from './DetalleSolicitud';
import { DetalleCotizacion } from './DetalleCotizacion';
import { DetalleOrden } from './DetalleOrden';
import { DetalleIncidencia } from './DetalleIncidencia';
import { ModalConsolidar } from './ModalConsolidar';

type Tab = 'solicitudes' | 'cotizaciones' | 'ordenes' | 'recepciones' | 'reclamos' | 'cuenta';
export type AbrirDetalle = (tipo: 'sc' | 'pc' | 'oc' | 'rec', id: string) => void;

// Página del módulo Compras: SC → PC → OC en tres pestañas. Los modales de detalle se
// abren por query param (?sc= / ?pc= / ?oc=) para poder linkear desde otras pantallas
// y desde una entidad a la siguiente (SC → su PC → su OC) sin perder el contexto.
export default function Compras() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'solicitudes';
  const scId = params.get('sc');
  const pcId = params.get('pc');
  const ocId = params.get('oc');
  const recId = params.get('rec');

  const [tablero, setTablero] = useState<TableroCompras | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [consolidar, setConsolidar] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.get<TableroCompras>('/compras/tablero')
      .then(d => { if (vivo) setTablero(d); })
      .catch(() => toast.error('Error al cargar el tablero de compras'));
    return () => { vivo = false; };
  }, [refresh]);

  const recargar = useCallback(() => setRefresh(n => n + 1), []);

  const setTab = (t: Tab) => {
    const p = new URLSearchParams(params);
    p.set('tab', t); p.delete('sc'); p.delete('pc'); p.delete('oc'); p.delete('rec');
    setParams(p, { replace: true });
  };

  // Abrir un detalle también cambia a su pestaña (SC → su PC → su OC navegan entre sí)
  const abrir: AbrirDetalle = useCallback((tipo, id) => {
    const p = new URLSearchParams(params);
    p.delete('sc'); p.delete('pc'); p.delete('oc'); p.delete('rec');
    p.set('tab', { sc: 'solicitudes', pc: 'cotizaciones', oc: 'ordenes', rec: 'reclamos' }[tipo]);
    p.set(tipo, id);
    setParams(p);
  }, [params, setParams]);

  const cerrarDetalle = useCallback(() => {
    const p = new URLSearchParams(params);
    p.delete('sc'); p.delete('pc'); p.delete('oc'); p.delete('rec');
    setParams(p, { replace: true });
  }, [params, setParams]);

  const s = tablero?.stats;
  const TABS: { value: Tab; label: string; icon: typeof ClipboardList; count: number | undefined; dot?: string }[] = [
    { value: 'solicitudes',  label: 'Solicitudes',  icon: ClipboardList, count: s?.sc_abiertas, dot: 'bg-amber-400' },
    { value: 'cotizaciones', label: 'Cotizaciones', icon: Scale,         count: s?.pc_abiertas, dot: 'bg-sky-400' },
    { value: 'ordenes',      label: 'Órdenes',      icon: PackageCheck,  count: s?.oc_activas,  dot: s?.oc_demoradas ? 'bg-red-500' : 'bg-emerald-500' },
    { value: 'recepciones',  label: 'Recepciones',  icon: Truck,         count: s?.oc_por_recibir, dot: 'bg-teal-400' },
    { value: 'reclamos',     label: 'Reclamos',     icon: AlertTriangle, count: s?.reclamos_abiertos, dot: 'bg-red-500' },
    { value: 'cuenta',       label: 'Cuenta corriente', icon: Wallet,    count: s?.oc_a_pagar,        dot: 'bg-amber-400' },
  ];

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section="pedidos">
      <SectionHero
        section="pedidos"
        icon={ShoppingCart}
        title="Compras"
        sub="Solicitudes, cotizaciones y órdenes a proveedores"
        actions={<>
          <HelpButton topic="compras" />
          <button onClick={() => setConsolidar(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-3 sm:px-4 h-11 sm:h-10 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors">
            <Layers size={16} /> <span className="hidden sm:inline">Consolidar</span><span className="sm:hidden">Consolidar</span>
          </button>
          <button onClick={() => navigate('/compras/oc/nueva')}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-3 sm:px-4 h-11 sm:h-10 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors"
            title="Pedido directo al proveedor desde una operación o para stock (flujo rápido)">
            <Zap size={16} /> Pedido rápido
          </button>
          <button onClick={() => navigate('/compras/nueva-solicitud')}
            className="flex items-center gap-2 bg-lime-600 text-white text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-lime-700 transition-colors shadow-md">
            <Plus size={16} /> Nueva solicitud
          </button>
        </>}
      />

      {/* Seis métricas con etiquetas cortas: a 1366px la barra no scrollea y se leen
          todas de un vistazo (ver CLAUDE.md, resolución de trabajo). */}
      {s && (
        <CompactStatsBar items={[
          { value: s.sc_abiertas,  label: 'solicitudes',       color: '#fbbf24' },
          { value: s.pc_esperando, label: 'esperando cotización', color: '#60a5fa' },
          { value: s.oc_en_curso,  label: 'órdenes en curso',  color: '#a3e635' },
          { value: s.oc_demoradas, label: 'demoradas',         color: s.oc_demoradas ? '#f87171' : '#ffffff' },
          { value: s.reclamos_abiertos, label: 'reclamos',     color: s.reclamos_abiertos ? '#fb923c' : '#ffffff' },
          { value: fmtMoneda(s.deuda_proveedores), label: 'a pagar', color: s.deuda_proveedores ? '#fbbf24' : '#ffffff' },
        ]} />
      )}

      {/* Pestañas con contadores (patrón Presupuestos) */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-10 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              tab === t.value
                ? 'bg-lime-600 text-white border-lime-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-lime-400 hover:text-lime-700'
            )}>
            <t.icon size={14} />
            {t.label}
            {t.count !== undefined && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1',
                tab === t.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600')}>
                {t.dot && tab !== t.value && <span className={cn('w-1.5 h-1.5 rounded-full', t.dot)} />}
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'solicitudes'  && <TabSolicitudes  abrir={abrir} refresh={refresh} />}
      {tab === 'cotizaciones' && <TabCotizaciones abrir={abrir} refresh={refresh} />}
      {tab === 'ordenes'      && <TabOrdenes      abrir={abrir} refresh={refresh} tablero={tablero} />}
      {tab === 'recepciones'  && <TabRecepciones  abrir={abrir} refresh={refresh} />}
      {tab === 'reclamos'     && <TabReclamos     abrir={abrir} refresh={refresh} />}
      {tab === 'cuenta'       && <TabCuentaCorriente abrir={abrir} refresh={refresh} onChanged={recargar} />}

      {scId && <DetalleSolicitud id={scId} onClose={cerrarDetalle} onChanged={recargar} abrir={abrir} />}
      {pcId && <DetalleCotizacion id={pcId} onClose={cerrarDetalle} onChanged={recargar} abrir={abrir} />}
      {ocId && <DetalleOrden id={ocId} onClose={cerrarDetalle} onChanged={recargar} abrir={abrir} />}
      {recId && <DetalleIncidencia id={recId} onClose={cerrarDetalle} onChanged={recargar} abrir={abrir} />}
      {consolidar && <ModalConsolidar onClose={() => setConsolidar(false)} onCreated={(id) => { setConsolidar(false); recargar(); abrir('oc', id); }} />}
    </div>
  );
}
