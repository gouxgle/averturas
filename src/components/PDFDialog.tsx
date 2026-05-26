import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, ExternalLink, Share2, Copy, Check, X, Send, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface PDFDialogProps {
  title: string;
  subtitle: string;
  pdfUrl: string;
  onClose: () => void;
  onNavigate: () => void;
  navigateLabel?: string;
  operacionId?: string;
  clienteNombre?: string;
  clienteTelefono?: string;
}

const WA_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export function PDFDialog({
  title, subtitle, pdfUrl, onClose, onNavigate,
  navigateLabel = 'Ver detalle', operacionId,
  clienteNombre, clienteTelefono,
}: PDFDialogProps) {
  const navigate = useNavigate();
  const [linkUrl,    setLinkUrl]    = useState('');
  const [copiado,    setCopiado]    = useState(false);
  const [preview,    setPreview]    = useState(false);
  const [enviando,   setEnviando]   = useState(false);
  const [enviado,    setEnviado]    = useState(false);

  const mensajePreview = (url: string) => {
    const nombre = clienteNombre ?? 'cliente';
    return `Hola ${nombre}, te enviamos el presupuesto para tu revisión.\n\nPodés aprobarlo desde este enlace:\n${url || '[link de aprobación]'}`;
  };

  function handlePDF() {
    window.open(pdfUrl, '_blank');
    onNavigate();
  }

  async function handleEnviarClick() {
    if (!operacionId) return;
    // Si ya tenemos link, mostramos preview directamente
    if (linkUrl) { setPreview(true); return; }
    // Si no, primero generamos el link para poder mostrarlo en la preview
    try {
      const { url } = await api.post<{ token: string; url: string }>(
        `/operaciones/${operacionId}/generar-link`, {}
      );
      setLinkUrl(url);
      setPreview(true);
    } catch {
      toast.error('Error al generar link');
    }
  }

  async function confirmarEnvio() {
    if (!operacionId) return;
    setEnviando(true);
    try {
      const res = await api.post<{ enviado: boolean; numero: string; url: string }>(
        `/operaciones/${operacionId}/enviar-whatsapp`, {}
      );
      setLinkUrl(res.url);
      setEnviado(true);
      toast.success(`Mensaje enviado al ${res.numero}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al enviar por WhatsApp');
    } finally {
      setEnviando(false);
    }
  }

  function copiar(texto: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).catch(() => fallbackCopy(texto));
    } else {
      fallbackCopy(texto);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function fallbackCopy(texto: string) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ── Vista previa / confirmación de envío ─────────────────────────────
  if (preview) {
    const partes = mensajePreview(linkUrl).split(linkUrl || '___');
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget && !enviado) setPreview(false); }}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {enviado ? <CheckCircle2 size={15} className="text-green-500" /> : WA_ICON}
              <p className="font-semibold text-gray-900 text-sm">
                {enviado ? 'Mensaje enviado' : 'Vista previa del mensaje'}
              </p>
            </div>
            {!enviado && (
              <button onClick={() => setPreview(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={15} className="text-gray-400" />
              </button>
            )}
          </div>

          {/* Burbuja WhatsApp con URL como enlace */}
          <div className="bg-[#dcf8c6] rounded-2xl rounded-tl-sm px-4 py-3 mb-4 shadow-sm">
            <p className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">
              {linkUrl ? (
                <>
                  {partes[0]}
                  <a href={linkUrl} target="_blank" rel="noreferrer"
                    className="text-blue-600 underline break-all">
                    {linkUrl}
                  </a>
                  {partes[1]}
                </>
              ) : mensajePreview('')}
            </p>
          </div>

          {clienteTelefono && (
            <p className="text-[11px] text-gray-400 text-center mb-4">
              {enviado ? `Enviado a ${clienteTelefono}` : `Se enviará a ${clienteTelefono}`}
            </p>
          )}

          <div className="flex flex-col gap-2">
            {enviado ? (
              <>
                <button onClick={() => navigate('/presupuestos')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
                  <ExternalLink size={14} /> Ver presupuestos
                </button>
                <button onClick={onNavigate}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  {navigateLabel}
                </button>
              </>
            ) : (
              <>
                <button onClick={confirmarEnvio} disabled={enviando}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#1ebe5a] disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
                  {enviando ? 'Enviando...' : <><Send size={14} /> Confirmar envío</>}
                </button>
                <button onClick={() => setPreview(false)}
                  className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Dialog principal ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{title}</p>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">

          <button onClick={handlePDF}
            style={{ backgroundColor: '#031d49' }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <FileDown size={15} /> Imprimir / Guardar PDF
          </button>

          {operacionId && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <Share2 size={12} className="text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Compartir con el cliente</span>
              </div>
              <div className="p-3 flex flex-col gap-2">

                {/* Enviar por WhatsApp → vista previa */}
                <button onClick={handleEnviarClick}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-lg text-sm font-semibold transition-colors">
                  {WA_ICON} Enviar por WhatsApp
                </button>

                {/* Copiar link (genera si no existe) */}
                <button onClick={async () => {
                  if (linkUrl) { copiar(linkUrl); return; }
                  try {
                    const { url } = await api.post<{ token: string; url: string }>(
                      `/operaciones/${operacionId}/generar-link`, {}
                    );
                    setLinkUrl(url);
                    copiar(url);
                    toast.success('Link generado y copiado');
                  } catch { toast.error('Error al generar link'); }
                }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors">
                  {copiado ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar link de aprobación</>}
                </button>

                {linkUrl && (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
                    <span className="flex-1 text-[10px] text-gray-500 truncate font-mono">{linkUrl}</span>
                    <button onClick={() => copiar(linkUrl)} className="shrink-0 text-gray-400 hover:text-violet-600 transition-colors">
                      {copiado ? <Check size={11} className="text-violet-500" /> : <Copy size={11} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button onClick={onNavigate}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <ExternalLink size={14} /> {navigateLabel}
          </button>

          <button onClick={onClose}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
