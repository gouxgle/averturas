import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, X, Printer, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';
import { MANUALES } from './manuales';
import { textoDeSeccion } from './tipos';

/**
 * Índice de los manuales del sistema. Cada tarjeta lleva al manual completo, y el
 * buscador mira adentro de todos: si escribís "bonificar", te dice en qué manual y en
 * qué sección está.
 */
export default function Manuales() {
  const [busqueda, setBusqueda] = useState('');
  const q = busqueda.trim().toLowerCase();

  const resultados = useMemo(() => {
    if (!q) return null;
    return MANUALES
      .map(m => ({ manual: m, secciones: m.secciones.filter(s => textoDeSeccion(s).includes(q)) }))
      .filter(r => r.secciones.length > 0);
  }, [q]);

  const totalSecciones = MANUALES.reduce((n, m) => n + m.secciones.length, 0);

  return (
    <div className="p-3 sm:p-4 xl:p-6 space-y-4 max-w-[1440px] mx-auto" data-section="config">
      <SectionHero
        section="config"
        icon={BookOpen}
        title="Manuales del sistema"
        sub={`${MANUALES.length} manuales · ${totalSecciones} secciones`}
      />

      <div className="bg-white rounded-2xl border border-gray-400 shadow-lg p-4 sm:p-6 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar en todos los manuales…"
            className="w-full pl-9 pr-9 h-11 text-base sm:text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center">
              <X size={14} className="text-gray-500" />
            </button>
          )}
        </div>

        {resultados ? (
          resultados.length === 0 ? (
            <p className="text-sm text-gray-600 py-6 text-center">
              No hay nada con <strong>"{busqueda}"</strong>. Probá con otra palabra.
            </p>
          ) : (
            <div className="space-y-4">
              {resultados.map(({ manual, secciones }) => (
                <div key={manual.slug}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    {manual.titulo}
                  </p>
                  <div className="space-y-1">
                    {secciones.map(s => (
                      <Link key={s.id} to={`/ayuda/${manual.slug}#${s.id}`}
                        className="flex items-center gap-2 px-3 h-11 rounded-xl border border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-colors">
                        <s.icono size={14} className="text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{s.titulo}</span>
                        <ChevronRight size={14} className="text-gray-400 ml-auto shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MANUALES.map(m => (
              <div key={m.slug}
                className="border border-gray-200 rounded-2xl p-4 hover:border-violet-400 hover:shadow-md transition-all flex flex-col">
                <Link to={`/ayuda/${m.slug}`} className="flex items-start gap-3 group">
                  <span className="w-11 h-11 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                    <m.icono size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
                      {m.titulo}
                    </span>
                    <span className="block text-xs text-gray-600 mt-0.5">{m.sub}</span>
                  </span>
                </Link>

                <ul className="mt-3 space-y-1 flex-1">
                  {m.secciones.slice(0, 4).map(s => (
                    <li key={s.id}>
                      <Link to={`/ayuda/${m.slug}#${s.id}`}
                        className="text-xs text-gray-600 hover:text-violet-700 hover:underline">
                        · {s.corto}
                      </Link>
                    </li>
                  ))}
                  {m.secciones.length > 4 && (
                    <li className="text-xs text-gray-500">· y {m.secciones.length - 4} secciones más</li>
                  )}
                </ul>

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <Link to={`/ayuda/${m.slug}`}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 h-11 sm:h-9 rounded-xl',
                      'bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors')}>
                    Abrir manual
                  </Link>
                  <button onClick={() => window.open(`/imprimir/manual/${m.slug}`, '_blank')}
                    title={`Imprimir el manual de ${m.titulo}`}
                    className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center transition-colors">
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
