import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '@/lib/api';
import { buscarManual } from '@/pages/ayuda/manuales';
import { SeccionVista } from '@/pages/ayuda/ContenidoManual';

interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null;
}

/**
 * Versión imprimible de cualquier manual del sistema (mismo contenido que `/ayuda/:slug`).
 * Pensada para dejar una copia en papel al lado de la PC.
 */
export function ImprimirManual() {
  const { manual: slug } = useParams<{ manual: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    api.get<Empresa>('/empresa').then(setEmpresa).catch(() => {});
  }, []);

  const manual = buscarManual(slug);
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (!manual) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">No existe ese manual.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen print:bg-white">
      {/* Barra de acciones — no sale impresa */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">Manual de {manual.titulo} — versión para imprimir</p>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-violet-600 text-white text-sm font-semibold px-4 h-10 rounded-xl hover:bg-violet-700">
            <Printer size={14} /> Imprimir / Guardar PDF
          </button>
          <button onClick={() => window.close()}
            className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold px-3 h-10 rounded-xl hover:bg-gray-50">
            <X size={14} /> Cerrar
          </button>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto bg-white p-6 sm:p-10 my-4 print:my-0 print:p-0 shadow-lg print:shadow-none">
        {/* Portada del documento */}
        <header className="pb-4 mb-6 border-b-2 border-[#031d49]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#031d49]">
                {empresa?.nombre ?? 'César Brítez Aberturas'}
              </p>
              <h1 className="text-2xl font-black text-gray-900 mt-0.5">Manual de {manual.titulo}</h1>
              <p className="text-sm text-gray-600">{manual.sub}</p>
            </div>
            <div className="text-right text-[11px] text-gray-500">
              <p>Actualizado: {hoy}</p>
              {empresa?.telefono && <p>{empresa.telefono}</p>}
            </div>
          </div>
        </header>

        {/* Índice */}
        <div className="mb-8 break-inside-avoid">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Contenido</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700 list-decimal pl-7">
            {manual.secciones.map(s => <li key={s.id}>{s.titulo}</li>)}
          </ol>
        </div>

        {manual.secciones.map((s, i) => <SeccionVista key={s.id} seccion={s} numero={i + 1} print />)}

        <footer className="pt-4 mt-4 border-t border-gray-300 text-[10px] text-gray-500 text-center">
          {[empresa?.nombre, empresa?.telefono, empresa?.email].filter(Boolean).join(' · ')}
        </footer>
      </div>

      {/* Márgenes de página y control de cortes al imprimir */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          h2, h3 { break-after: avoid; }
          table, ul, ol { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
