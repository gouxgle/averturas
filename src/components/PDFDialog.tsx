import { useState } from 'react';
import { FileDown, ExternalLink, Share2, Copy, Check, MessageCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface PDFDialogProps {
  title: string;
  subtitle: string;
  pdfUrl: string;
  onClose: () => void;
  onNavigate: () => void;
  navigateLabel?: string;
  operacionId?: string; // si se provee, habilita el bloque "Compartir"
}

export function PDFDialog({
  title, subtitle, pdfUrl, onClose, onNavigate,
  navigateLabel = 'Ver detalle', operacionId,
}: PDFDialogProps) {
  const [linkUrl,       setLinkUrl]       = useState('');
  const [generando,     setGenerando]     = useState(false);
  const [copiado,       setCopiado]       = useState(false);

  function handlePDF() {
    window.open(pdfUrl, '_blank');
    onNavigate();
  }

  async function generarLink() {
    if (linkUrl) {
      // ya generado — solo copia
      copiar(linkUrl);
      return;
    }
    setGenerando(true);
    try {
      const { url } = await api.post<{ token: string; url: string }>(
        `/operaciones/${operacionId}/generar-link`, {}
      );
      setLinkUrl(url);
      copiar(url);
      toast.success('Link generado y copiado');
    } catch {
      toast.error('Error al generar link');
    } finally {
      setGenerando(false);
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

  function abrirWhatsApp() {
    if (!linkUrl) return;
    const msg = encodeURIComponent(`Hola! Te comparto tu presupuesto para que lo revises y apruebes:\n${linkUrl}`);
    window.open(`https://web.whatsapp.com/send?text=${msg}`, 'whatsapp_web');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">

        {/* Encabezado */}
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

          {/* PDF */}
          <button onClick={handlePDF}
            style={{ backgroundColor: '#031d49' }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
            <FileDown size={15} /> Imprimir / Guardar PDF
          </button>

          {/* Compartir — solo si se pasa operacionId */}
          {operacionId && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <Share2 size={12} className="text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Compartir con el cliente</span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {/* Generar / Copiar link */}
                <button onClick={generarLink} disabled={generando}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold transition-colors">
                  {generando
                    ? <><RefreshCw size={12} className="animate-spin" /> Generando link...</>
                    : copiado
                    ? <><Check size={12} /> Copiado!</>
                    : linkUrl
                    ? <><Copy size={12} /> Copiar link</>
                    : <><Share2 size={12} /> Generar link de aprobación</>
                  }
                </button>

                {/* WhatsApp — aparece una vez generado el link */}
                {linkUrl && (
                  <button onClick={abrirWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors">
                    <MessageCircle size={12} /> Enviar por WhatsApp
                  </button>
                )}

                {/* Link copiable */}
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

          {/* Ver detalle */}
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
