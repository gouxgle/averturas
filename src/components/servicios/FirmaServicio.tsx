import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, RefreshCw, AlertTriangle, PenLine, ChevronLeft, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { toastApiError } from '@/lib/apiError';
import { cn } from '@/lib/utils';
import { FirmaDigital, type FirmaDigitalHandle } from '@/components/FirmaDigital';
import { ENDPOINT_ADJUNTOS_SERVICIO, TRABAJO_TIPO, type Intervencion } from '@/lib/servicios';

const MOTIVOS_SIN_FIRMA = ['Cliente ausente (firmó otra persona de palabra)', 'Se negó a firmar'];

// Conformidad del cliente al terminar una visita, en el celular del técnico (mismo armado que la entrega en el
// lugar de los remitos): resumen de lo hecho, conforme o con observaciones, aclaración, DNI y firma con el dedo.
// La firma deja constancia del servicio recibido; no impide reclamos futuros.
export function FirmaServicio({ servicioId, numero, cliente, visita, onClose, onFirmada }: {
  servicioId: string; numero: string; cliente: string; visita: Intervencion;
  onClose: () => void; onFirmada: (finalizado: boolean) => void;
}) {
  const firmaRef = useRef<FirmaDigitalHandle>(null);
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null);
  const [conformidad, setConformidad] = useState<'conforme' | 'con_observaciones'>('conforme');
  const [obs, setObs] = useState('');
  const [nombre, setNombre] = useState(cliente.includes(',') ? cliente.split(',').reverse().map(x => x.trim()).join(' ') : cliente);
  const [dni, setDni] = useState('');
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
  const listo = nombre.trim().length >= 2 && dniValido && (conformidad === 'conforme' || obs.trim().length > 0);

  async function confirmar(conFirma: boolean) {
    if (!listo) return;
    setEnviando(true);
    try {
      let url = firmaUrl;
      if (conFirma) {
        url = (await firmaRef.current?.subir()) ?? firmaUrl;
        if (!url) { setEnviando(false); setSinFirma(true); return; }
      }
      const r = await api.post<{ finalizado: boolean }>(`/servicios-tecnicos/${servicioId}/intervenciones/${visita.id}/firmar`, {
        firma_url: conFirma ? url : null, sin_firma_motivo: conFirma ? null : motivoFinal,
        recibio_nombre: nombre.trim(), recibio_dni: dni || null, conformidad, conformidad_obs: conformidad === 'conforme' ? null : obs.trim(),
      });
      toast.success(r.finalizado ? 'Firmado: el servicio quedó finalizado' : 'Firmado');
      onFirmada(r.finalizado);
    } catch (e) {
      toastApiError(e, { fallback: 'No se pudo guardar la firma' });
    } finally {
      setEnviando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9200] bg-black/50 backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget && !enviando) onClose(); }}>
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-lg sm:rounded-2xl shadow-2xl flex flex-col" data-testid="firma-servicio">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0"><PenLine size={18} className="text-teal-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight">Conformidad del cliente</p>
            <p className="text-xs text-gray-600 truncate">{numero} · visita {visita.orden} · {cliente}</p>
          </div>
          <button type="button" onClick={onClose} disabled={enviando} aria-label="Cerrar"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-600 disabled:opacity-40"><X size={20} /></button>
        </div>

        {sinFirma ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-red-50/40">
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">¿Guardar sin firma del cliente?</p>
                <p className="text-xs mt-0.5">La ficha queda con el motivo. La conformidad y la aclaración se guardan igual.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[...MOTIVOS_SIN_FIRMA, 'Otro'].map(m => (
                <button key={m} type="button" onClick={() => setMotivo(m)}
                  className={cn('h-11 px-3 rounded-xl border-2 text-left text-sm font-medium', motivo === m ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-700')}>
                  {m}
                </button>
              ))}
            </div>
            {motivo === 'Otro' && (
              <input value={motivoOtro} onChange={e => setMotivoOtro(e.target.value)} autoFocus maxLength={300} placeholder="Contá brevemente qué pasó"
                className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-red-400" />
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl border border-gray-200 p-3 text-sm space-y-1">
              <p className="font-semibold text-gray-900">{TRABAJO_TIPO[visita.trabajo_tipo]}</p>
              <p className="text-gray-700 whitespace-pre-wrap">{visita.trabajo_detalle}</p>
              {visita.materiales.length > 0 && <p className="text-xs text-gray-600">Repuestos: {visita.materiales.map(m => `${m.cantidad} × ${m.descripcion}`).join(', ')}</p>}
              <p className="text-xs text-gray-600">{visita.con_cargo ? 'Con cargo al cliente' : 'Sin cargo'}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5">El cliente recibió el servicio</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setConformidad('conforme')} aria-pressed={conformidad === 'conforme'} data-testid="conformidad-conforme"
                  className={cn('h-12 px-3 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2',
                    conformidad === 'conforme' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700')}>
                  <CheckCircle2 size={17} /> Conforme
                </button>
                <button type="button" onClick={() => setConformidad('con_observaciones')} aria-pressed={conformidad === 'con_observaciones'} data-testid="conformidad-obs"
                  className={cn('h-12 px-3 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2',
                    conformidad === 'con_observaciones' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 text-gray-700')}>
                  <MessageSquareWarning size={17} /> Con observaciones
                </button>
              </div>
              {conformidad === 'con_observaciones' && (
                <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} maxLength={2000} autoFocus placeholder="¿Qué observa el cliente?"
                  className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3">
                <label htmlFor="fs-nombre" className="block text-xs font-semibold text-gray-700 mb-1">Recibe (aclaración)</label>
                <input id="fs-nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} autoComplete="off" placeholder="Nombre y apellido"
                  className="w-full h-11 border border-gray-300 rounded-xl px-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="fs-dni" className="block text-xs font-semibold text-gray-700 mb-1">DNI <span className="font-normal text-gray-500">(opcional)</span></label>
                <input id="fs-dni" value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" autoComplete="off" placeholder="Solo números"
                  className={cn('w-full h-11 border rounded-xl px-3 text-base focus:outline-none focus:ring-2', dniValido ? 'border-gray-300 focus:ring-teal-500' : 'border-red-400 focus:ring-red-400')} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Firma del cliente</p>
              <p className="text-[11px] text-gray-600 mb-2">Firmá con el dedo dentro del recuadro. Deja constancia del servicio recibido; no impide reclamos futuros.</p>
              <FirmaDigital ref={firmaRef} value={firmaUrl} onChange={setFirmaUrl} grande sinGuardar uploadEndpoint={ENDPOINT_ADJUNTOS_SERVICIO} />
            </div>
          </div>
        )}

        <div className="shrink-0 border-t border-gray-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 bg-white sm:rounded-b-2xl">
          {sinFirma ? (
            <>
              <button type="button" onClick={() => setSinFirma(false)} disabled={enviando}
                className="h-12 px-4 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 flex items-center gap-1"><ChevronLeft size={16} /> Firmar</button>
              <button type="button" onClick={() => confirmar(false)} disabled={enviando || !motivoFinal || !listo}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {enviando && <RefreshCw size={15} className="animate-spin" />} Guardar sin firma
              </button>
            </>
          ) : (
            <button type="button" onClick={() => confirmar(true)} disabled={enviando || !listo} data-testid="confirmar-firma"
              className="flex-1 h-12 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {enviando ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={18} />} Confirmar conformidad
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
