import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Navigate, Link } from 'react-router-dom';
import { Search, X, Printer, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import { buscarManual, MANUALES, type Manual } from './manuales';
import { textoDeSeccion } from './tipos';
import { SeccionVista } from './ContenidoManual';

/**
 * Un manual del sistema: índice lateral, buscador e impresión. El contenido vive en
 * `manualX.ts` y lo comparte con `/imprimir/manual/:slug`.
 */
export default function Ayuda() {
  const { manual: slug } = useParams<{ manual: string }>();
  const manual = buscarManual(slug);
  if (!manual) return <Navigate to="/ayuda" replace />;
  // `key` remonta al cambiar de manual: así la búsqueda arranca vacía sin un efecto
  // que resetee estado (que además dispara un render de más).
  return <ManualVista key={manual.slug} manual={manual} />;
}

function ManualVista({ manual }: { manual: Manual }) {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  // Si se entró con un ancla (#seccion) desde el índice, bajar hasta ahí.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 80);
  }, []);

  const q = busqueda.trim().toLowerCase();
  const secciones = useMemo(
    () => (q ? manual.secciones.filter(s => textoDeSeccion(s).includes(q)) : manual.secciones),
    [manual, q]
  );

  function irA(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section={manual.seccion}>
      <SectionHero
        section={manual.seccion}
        icon={manual.icono}
        title={`Manual de ${manual.titulo}`}
        sub={manual.sub}
        actions={<>
          <button onClick={() => navigate('/ayuda')}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors">
            <ArrowLeft size={16} /> Todos los manuales
          </button>
          <button onClick={() => navigate(manual.ruta)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-colors">
            <manual.icono size={16} /> {manual.rutaLabel}
          </button>
          <button onClick={() => window.open(`/imprimir/manual/${manual.slug}`, '_blank')}
            className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl hover:bg-violet-700 transition-colors shadow-md">
            <Printer size={16} /> Imprimir
          </button>
        </>}
      />

      <div className="flex flex-col xl:flex-row gap-4 xl:items-start">
        {/* Índice */}
        <nav className="w-full xl:w-[250px] xl:shrink-0 xl:sticky xl:top-4 bg-white rounded-2xl border border-gray-400 shadow-lg p-3">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar en el manual…"
              className="w-full pl-8 pr-8 h-10 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
            {busqueda && (
              <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center">
                <X size={13} className="text-gray-500" />
              </button>
            )}
          </div>
          <div className="flex xl:flex-col gap-1 overflow-x-auto xl:overflow-visible pb-1 xl:pb-0">
            {manual.secciones.map(s => {
              const visible = secciones.some(v => v.id === s.id);
              return (
                <button key={s.id} onClick={() => irA(s.id)} disabled={!visible}
                  className={cn('flex items-center gap-2 px-2.5 h-10 xl:h-9 rounded-lg text-xs font-medium text-left whitespace-nowrap xl:whitespace-normal shrink-0 xl:shrink transition-colors',
                    visible ? 'text-gray-700 hover:bg-violet-50 hover:text-violet-800' : 'text-gray-300 cursor-default')}>
                  <s.icono size={13} className="shrink-0" />
                  <span className="truncate">{s.corto}</span>
                </button>
              );
            })}
          </div>

          {/* Los otros manuales, a un clic */}
          <div className="mt-3 pt-3 border-t border-gray-200 hidden xl:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Otros manuales</p>
            {MANUALES.filter(m => m.slug !== manual.slug).map(m => (
              <Link key={m.slug} to={`/ayuda/${m.slug}`}
                className="flex items-center gap-2 px-2.5 h-9 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <m.icono size={13} className="shrink-0" />
                <span className="truncate">{m.titulo}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Contenido */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-400 shadow-lg p-4 sm:p-6">
          {q && (
            <p className="text-xs text-gray-600 mb-4 pb-3 border-b border-gray-200">
              {secciones.length === 0
                ? <>No hay nada con <strong>"{busqueda}"</strong>. Probá con otra palabra.</>
                : <>{secciones.length} de {manual.secciones.length} secciones con <strong>"{busqueda}"</strong>.</>}
            </p>
          )}
          {secciones.map(s => (
            <SeccionVista key={s.id} seccion={s} numero={manual.secciones.indexOf(s) + 1} />
          ))}
          {secciones.length > 0 && (
            <p className="text-[11px] text-gray-500 pt-4 border-t border-gray-200">
              ¿Algo no coincide con lo que ves en pantalla? Avisá y se corrige el manual.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
