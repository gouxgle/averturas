import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, RefreshCw, AlertTriangle, MapPin, PenLine, ChevronLeft } from 'lucide-react';
import { FirmaDigital, type FirmaDigitalHandle } from '@/components/FirmaDigital';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/apiError';
import { cn, fechaDiaAR } from '@/lib/utils';

export interface DatosEntrega {
  fecha_entrega_real?: string;
  firma_url?: string | null;
  recibio_nombre?: string | null;
  recibio_dni?: string | null;
  sin_firma_motivo?: string | null;
}

export interface ResumenEntrega {
  /** Vacío al crear el remito en el lugar (todavía no tiene número). */
  numero?: string;
  cliente: string;
  direccion?: string | null;
  items: { descripcion: string; cantidad: number }[];
}

const MOTIVOS_SIN_FIRMA = ['Cliente ausente', 'Se dejó en obra / domicilio', 'Se negó a firmar'];

// Entrega en el lugar desde el celular: quién recibe (aclaración + DNI), firma del
// cliente y confirmación. Pantalla completa en el celular, modal en desktop. La firma
// se sube recién al confirmar (no hay paso "Guardar firma" que olvidarse). Sin firma
// se puede, pero pide confirmar con un motivo.
// `modo='firmar'` = agregar la firma a un remito ya entregado sin firma.
export function EntregaEnSitio({ resumen, modo = 'entregar', nombreSugerido, onConfirmar, onClose }: {
  resumen: ResumenEntrega;
  modo?: 'entregar' | 'firmar';
  nombreSugerido?: string;
  /** Hace la llamada a la API; si tira, se muestra el error y queda abierto para reintentar
   * (la firma ya subida no se pierde). */
  onConfirmar: (datos: DatosEntrega) => Promise<void>;
  onClose: () => void;
}) {
  const firmaRef = useRef<FirmaDigitalHandle>(null);
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null);
  const [nombre, setNombre] = useState(nombreSugerido ?? '');
  const [dni, setDni] = useState('');
  const [fecha, setFecha] = useState(fechaDiaAR(new Date()));
  const [sinFirma, setSinFirma] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, enviando]);

  const dniValido = !dni || /^\d{7,11}$/.test(dni);
  const motivoFinal = motivo === 'Otro' ? motivoOtro.trim() : motivo;

  async function confirmar(conFirma: boolean) {
    if (!dniValido) return;
    setEnviando(true);
    try {
      let url = firmaUrl;
      if (conFirma) {
        url = (await firmaRef.current?.subir()) ?? firmaUrl;
        if (!url) {
          setEnviando(false);
          if (modo === 'firmar') toast.error('Falta la firma: dibujala dentro del recuadro');
          else setSinFirma(true);
          return;
        }
      }
      await onConfirmar({
        fecha_entrega_real: modo === 'entregar' ? fecha : undefined,
        firma_url: conFirma ? url : null,
        recibio_nombre: nombre.trim() || null,
        recibio_dni: dni || null,
        sin_firma_motivo: conFirma ? null : motivoFinal,
      });
    } catch (e) {
      toastApiError(e, { fallback: modo === 'firmar' ? 'No se pudo guardar la firma' : 'No se pudo registrar la entrega' });
    } finally {
      setEnviando(false);
    }
  }

  const titulo = modo === 'firmar' ? 'Agregar firma' : 'Entrega en el lugar';

  // Portal a <body>: dentro del layout el buzón de comentarios (fixed, abajo a la
  // izquierda) quedaba por encima del pie y tapaba "Confirmar entrega".
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !enviando) onClose(); }}>
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col"
        data-testid="entrega-en-sitio">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <PenLine size={18} className="text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight">{titulo}</p>
            <p className="text-xs text-gray-600 truncate">
              {resumen.numero ? `${resumen.numero} · ` : 'Remito nuevo · '}{resumen.cliente}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={enviando} aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        {sinFirma ? (
          /* Confirmación destructiva dentro del modal: entregar sin firma */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-red-50/40">
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">¿Entregar sin firma del cliente?</p>
                <p className="text-xs mt-0.5">El remito queda marcado "sin firma". Después se puede agregar la firma desde el detalle.</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Motivo</p>
              <div className="grid grid-cols-1 gap-2">
                {[...MOTIVOS_SIN_FIRMA, 'Otro'].map(m => (
                  <button key={m} type="button" onClick={() => setMotivo(m)}
                    className={cn('h-11 px-3 rounded-xl border-2 text-left text-sm font-medium transition-colors',
                      motivo === m ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-700')}>
                    {m}
                  </button>
                ))}
              </div>
              {motivo === 'Otro' && (
                <input value={motivoOtro} onChange={e => setMotivoOtro(e.target.value)} autoFocus maxLength={300}
                  placeholder="Contá brevemente qué pasó"
                  className="mt-2 w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-red-400" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Qué se entrega */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {resumen.direccion && (
                <p className="flex items-start gap-1.5 px-3 py-2 bg-blue-50 text-xs text-blue-800">
                  <MapPin size={12} className="shrink-0 mt-0.5" /> {resumen.direccion}
                </p>
              )}
              <ul className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
                {resumen.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-gray-800 min-w-0">{it.descripcion}</span>
                    <span className="font-semibold text-gray-700 shrink-0">x{it.cantidad}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quién recibe */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3">
                <label htmlFor="ent-nombre" className="block text-xs font-semibold text-gray-700 mb-1">Recibe (aclaración)</label>
                <input id="ent-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120}
                  autoComplete="off" placeholder="Nombre y apellido"
                  className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ent-dni" className="block text-xs font-semibold text-gray-700 mb-1">DNI</label>
                <input id="ent-dni" value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  inputMode="numeric" autoComplete="off" placeholder="Solo números"
                  className={cn('w-full h-11 border rounded-xl px-3 text-base focus:outline-none focus:ring-2',
                    dniValido ? 'border-gray-300 focus:ring-emerald-500' : 'border-red-400 focus:ring-red-400')} />
                {!dniValido && <p className="text-[11px] text-red-600 mt-1">Entre 7 y 11 números</p>}
              </div>
            </div>

            {/* Firma */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Firma del cliente</p>
              <p className="text-[11px] text-gray-600 mb-2">Firmá con el dedo dentro del recuadro. Girar el celular da más espacio.</p>
              <FirmaDigital ref={firmaRef} value={firmaUrl} onChange={setFirmaUrl} grande sinGuardar
                uploadEndpoint="/api/remitos/upload-imagen" />
            </div>

            {modo === 'entregar' && (
              <div className="flex items-center gap-2">
                <label htmlFor="ent-fecha" className="text-xs font-semibold text-gray-700 shrink-0">Fecha de entrega</label>
                <input id="ent-fecha" type="date" value={fecha} max={fechaDiaAR(new Date())} onChange={e => setFecha(e.target.value)}
                  className="h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            )}
          </div>
        )}

        {/* Pie fijo */}
        <div className="shrink-0 border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 bg-white sm:rounded-b-2xl">
          {sinFirma ? (
            <>
              <button type="button" onClick={() => setSinFirma(false)} disabled={enviando}
                className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 flex items-center gap-1">
                <ChevronLeft size={16} /> Firmar
              </button>
              <button type="button" onClick={() => confirmar(false)} disabled={enviando || !motivoFinal}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {enviando && <RefreshCw size={15} className="animate-spin" />} Entregar sin firma
              </button>
            </>
          ) : (
            <button type="button" onClick={() => confirmar(true)} disabled={enviando || !dniValido}
              className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {enviando ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {modo === 'firmar' ? 'Guardar firma' : 'Confirmar entrega'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
