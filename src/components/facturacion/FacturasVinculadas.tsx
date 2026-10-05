import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptText } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface Vinculado { id: string; estado: string; tipo_doc: string; clase: string; punto_venta: number; numero: string | null }

const ETIQUETA: Record<string, string> = { factura: 'Factura', nota_credito: 'NC', nota_debito: 'ND' };
const COLOR: Record<string, string> = {
  autorizado: 'bg-emerald-50 text-emerald-800 border-emerald-200', rechazado: 'bg-red-50 text-red-700 border-red-200',
  incierto: 'bg-amber-50 text-amber-800 border-amber-200', emitiendo: 'bg-sky-50 text-sky-800 border-sky-200',
  borrador: 'bg-gray-50 text-gray-700 border-gray-200', contingencia: 'bg-sky-50 text-sky-800 border-sky-200',
};

/**
 * Facturas de un recibo, remito o presupuesto (chips que abren el detalle) + botón "Facturar".
 * Se usa en el detalle de Recibos, Remitos y Presupuestos.
 */
export function FacturasVinculadas({ reciboId, operacionId, remitoId, puedeFacturar = true }: {
  reciboId?: string; operacionId?: string; remitoId?: string; puedeFacturar?: boolean;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lista, setLista] = useState<Vinculado[]>([]);
  const filtro = remitoId ? `remito_id=${remitoId}` : reciboId ? `recibo_id=${reciboId}` : `operacion_id=${operacionId}`;

  useEffect(() => {
    api.get<Vinculado[]>(`/facturacion/comprobantes?${filtro}`, { silent: true }).then(setLista).catch(() => {});
  }, [filtro]);

  const emite = puedeFacturar && (user?.rol === 'admin' || user?.rol === 'vendedor');
  if (!lista.length && !emite) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {lista.map(c => (
        <button key={c.id} onClick={() => navigate(`/facturacion?cbte=${c.id}`)}
          className={cn('inline-flex items-center gap-1 px-2 h-8 rounded-md border text-[11px] font-semibold', COLOR[c.estado] ?? COLOR.borrador)}>
          <ReceiptText size={12} />
          {ETIQUETA[c.tipo_doc] ?? c.tipo_doc} {c.clase} {c.numero ? `${String(c.punto_venta).padStart(5, '0')}-${String(c.numero).padStart(8, '0')}` : `(${c.estado})`}
        </button>
      ))}
      {emite && (
        <button onClick={() => navigate(`/facturacion/nueva?${filtro}`)}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-fuchsia-300 bg-fuchsia-50 text-xs font-semibold text-fuchsia-800 hover:bg-fuchsia-100">
          <ReceiptText size={13} /> Facturar
        </button>
      )}
    </div>
  );
}
