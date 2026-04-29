import { FileDown, ExternalLink } from 'lucide-react';

interface PDFDialogProps {
  title: string;
  subtitle: string;
  pdfUrl: string;
  onClose: () => void;
  onNavigate: () => void;
  navigateLabel?: string;
}

export function PDFDialog({ title, subtitle, pdfUrl, onClose, onNavigate, navigateLabel = 'Ver detalle' }: PDFDialogProps) {
  function handlePDF() {
    window.open(pdfUrl, '_blank');
    onNavigate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
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
          <button onClick={onNavigate}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <ExternalLink size={14} /> {navigateLabel}
          </button>
          <button onClick={onClose}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600">
            Cerrar sin imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
