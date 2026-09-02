import { X, Pen, User } from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// Una versión guardada del presupuesto, mostrada como la vio el cliente: ítems con
// sus medidas y specs, forma de pago, entrega, validez, envío, observaciones y
// totales. Todo sale del snapshot (las filas completas de `operaciones` y
// `operacion_items` congeladas antes de la edición) — no se recalcula nada.
//
// Único dato que NO está congelado: los nombres de tipo de abertura, línea y
// producto, que en el snapshot son solo ids y el backend resuelve contra el
// catálogo actual. Si un producto se renombró después, se ve el nombre de hoy; el
// texto que leyó el cliente (`descripcion`) sí es el original.

export interface ItemVersion {
  id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_lista?: number | null;
  precio_instalacion: number;
  incluye_instalacion: boolean;
  medida_ancho: number | null;
  medida_alto: number | null;
  color: string | null;
  vidrio: string | null;
  premarco?: boolean;
  notas?: string | null;
  tipo_abertura_nombre?: string | null;
  sistema_nombre?: string | null;
  producto_nombre?: string | null;
}

export interface OperacionVersion {
  numero?: string;
  forma_pago: string | null;
  tiempo_entrega: number | null;
  fecha_validez: string | null;
  forma_envio: string | null;
  costo_envio: number | null;
  notas: string | null;
  notas_internas?: string | null;
  precio_total: number;
}

const ENVIO_LABEL: Record<string, string> = {
  retiro_local:     'Retiro en local',
  envio_bonificado: 'Envío bonificado',
  envio_destino:    'Envío a destino',
  envio_empresa:    'Envío por empresa de transporte',
};

function totalItem(it: ItemVersion): number {
  return (Number(it.precio_unitario) + (it.incluye_instalacion ? Number(it.precio_instalacion) : 0)) * it.cantidad;
}

function fmtFecha(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T12:00:00')
    .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ModalVersionPresupuesto({
  version, origen, fecha, autor, operacion, items, numero, onClose,
}: {
  version: number;
  origen: 'cliente' | 'interna' | string;
  fecha: string;
  autor: string | null;
  operacion: OperacionVersion;
  items: ItemVersion[];
  numero: string;
  onClose: () => void;
}) {
  const subtotal   = items.reduce((s, it) => s + totalItem(it), 0);
  const costoEnvio = operacion.forma_envio === 'envio_empresa' ? Number(operacion.costo_envio ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        <div className="shrink-0 border-b border-gray-200 px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">
              {numero} — versión {version}
            </p>
            <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
              <span>Así se le mostró al cliente hasta el {formatDate(fecha)}</span>
              {autor && <span className="flex items-center gap-1"><User size={10}/>{autor}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              'text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1',
              origen === 'cliente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600',
            )}>
              <Pen size={9}/>{origen === 'cliente' ? 'Cambió a pedido del cliente' : 'Cambió por corrección interna'}
            </span>
            <button onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* Condiciones de la proforma en ese momento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Forma de pago', operacion.forma_pago ?? '—'],
              ['Entrega', operacion.tiempo_entrega ? `${operacion.tiempo_entrega} días hábiles` : '—'],
              ['Válido hasta', operacion.fecha_validez ? fmtFecha(operacion.fecha_validez) : '—'],
              ['Envío', operacion.forma_envio ? (ENVIO_LABEL[operacion.forma_envio] ?? operacion.forma_envio) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-xl px-3 py-2 min-w-0">
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">{k}</p>
                <p className="text-xs font-medium text-gray-800 break-words">{v}</p>
              </div>
            ))}
          </div>

          {/* Ítems */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {items.map((it, i) => {
              const specs: string[] = [];
              if (it.tipo_abertura_nombre) specs.push(it.tipo_abertura_nombre);
              if (it.sistema_nombre)       specs.push(it.sistema_nombre);
              if (it.medida_ancho || it.medida_alto)
                specs.push(`${it.medida_ancho ?? '—'} × ${it.medida_alto ?? '—'} m`);
              if (it.color)   specs.push(it.color);
              if (it.vidrio)  specs.push(`Vidrio ${it.vidrio}`);
              if (it.premarco) specs.push('Con premarco');
              return (
                <div key={it.id ?? i} className={cn('px-3 py-2.5', i % 2 === 1 && 'bg-gray-50')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-gray-800">
                        {i + 1}. {it.descripcion}
                        {it.cantidad > 1 && <span className="text-gray-600"> × {it.cantidad}</span>}
                      </p>
                      {specs.length > 0 && (
                        <p className="text-[11px] text-gray-600 mt-0.5">{specs.join(' · ')}</p>
                      )}
                      {it.incluye_instalacion && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">Incluye instalación</p>
                      )}
                      {it.notas && (
                        <p className="text-[11px] text-gray-600 italic mt-0.5">{it.notas}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-gray-800 tabular-nums">{formatCurrency(totalItem(it))}</p>
                      {it.cantidad > 1 && (
                        <p className="text-[10px] text-gray-600 tabular-nums">
                          {formatCurrency(Number(it.precio_unitario))} c/u
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Observaciones — el motivo principal de poder abrir una versión vieja */}
          {operacion.notas && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
              <p className="text-[10px] font-bold text-sky-800 uppercase tracking-wide mb-1">Observaciones</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{operacion.notas}</p>
            </div>
          )}
          {operacion.notas_internas && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                Notas internas (no las vio el cliente)
              </p>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{operacion.notas_internas}</p>
            </div>
          )}

          {/* Totales */}
          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Subtotal de ítems</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            {costoEnvio > 0 && (
              <div className="flex justify-between text-xs text-gray-600">
                <span>Envío</span>
                <span className="tabular-nums">{formatCurrency(costoEnvio)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-300">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Total de esta versión</span>
              <span className="text-lg font-black text-gray-900 tabular-nums">
                {formatCurrency(Number(operacion.precio_total) + costoEnvio)}
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 px-4 sm:px-5 py-3 flex justify-end">
          <button onClick={onClose} className="h-11 px-6 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
