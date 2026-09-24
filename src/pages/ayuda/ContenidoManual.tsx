import { Fragment } from 'react';
import { ChevronRight, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Bloque, SeccionManual } from './tipos';

/** `**negrita**` → <strong>. Es el único formato que usan los textos del manual. */
function Texto({ children }: { children: string }) {
  const partes = children.split(/\*\*(.+?)\*\*/g);
  return <>{partes.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-semibold text-gray-900">{p}</strong> : <Fragment key={i}>{p}</Fragment>))}</>;
}

const AVISO_CFG = {
  info:  { icono: Info,        cls: 'border-sky-200 bg-sky-50 text-sky-900',           it: 'text-sky-600' },
  ojo:   { icono: AlertTriangle, cls: 'border-amber-300 bg-amber-50 text-amber-900',   it: 'text-amber-600' },
  regla: { icono: ShieldCheck, cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', it: 'text-emerald-600' },
} as const;

function BloqueVista({ b, print }: { b: Bloque; print?: boolean }) {
  if (b.t === 'p') return <p className="text-sm sm:text-[15px] text-gray-700 leading-relaxed"><Texto>{b.texto}</Texto></p>;

  if (b.t === 'subtitulo') return <h3 className="text-sm font-bold text-gray-900 pt-1">{b.texto}</h3>;

  if (b.t === 'lista') {
    const Tag = b.ordenada ? 'ol' : 'ul';
    return (
      <Tag className={cn('space-y-1.5 pl-5 text-sm sm:text-[15px] text-gray-700 leading-relaxed',
        b.ordenada ? 'list-decimal' : 'list-disc')}>
        {b.items.map((it, i) => <li key={i}><Texto>{it}</Texto></li>)}
      </Tag>
    );
  }

  if (b.t === 'aviso') {
    const cfg = AVISO_CFG[b.tono];
    return (
      <div className={cn('flex items-start gap-2.5 p-3 rounded-xl border', cfg.cls, print && 'break-inside-avoid')}>
        <cfg.icono size={16} className={cn('mt-0.5 shrink-0', cfg.it)} />
        <p className="text-sm leading-relaxed"><Texto>{b.texto}</Texto></p>
      </div>
    );
  }

  if (b.t === 'flujo') {
    return (
      <div className={cn('flex items-center gap-1 flex-wrap', print && 'break-inside-avoid')}>
        {b.nodos.map((n, i) => (
          <Fragment key={n}>
            <span className="inline-flex items-center px-2.5 h-8 rounded-full border border-lime-300 bg-lime-50 text-[11px] font-semibold text-lime-900 whitespace-nowrap">{n}</span>
            {i < b.nodos.length - 1 && <ChevronRight size={12} className="text-gray-400 shrink-0" />}
          </Fragment>
        ))}
      </div>
    );
  }

  // Tabla: en mobile se muestra como tarjetas (una por fila) y en desktop como tabla,
  // en el mismo componente — misma convención que el resto del sistema.
  return (
    <div className={print ? 'break-inside-avoid' : undefined}>
      {/* En pantalla la tabla scrollea si no entra; en papel no hay scroll posible,
          así que se deja que el texto se acomode solo. */}
      <div className={cn('border border-gray-200 rounded-xl', print ? 'overflow-hidden' : 'overflow-x-auto hidden sm:block')}>
        <table className={cn('w-full text-sm', print && 'table-fixed')}>
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-600">
            <tr>{b.cols.map(c => <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {b.filas.map((f, i) => (
              <tr key={i} className="align-top">
                {f.map((celda, j) => (
                  <td key={j} className={cn('px-3 py-2 text-gray-700', j === 0 && 'font-medium text-gray-900')}>
                    <Texto>{celda}</Texto>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!print && (
        <div className="sm:hidden space-y-2">
          {b.filas.map((f, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-900"><Texto>{f[0]}</Texto></p>
              {f.slice(1).map((celda, j) => (
                <p key={j} className="text-[13px] text-gray-700 mt-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 block">{b.cols[j + 1]}</span>
                  <Texto>{celda}</Texto>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Una sección completa del manual. `print` compacta y evita cortes feos de página. */
export function SeccionVista({ seccion, print, numero }: { seccion: SeccionManual; print?: boolean; numero?: number }) {
  const Icono = seccion.icono;
  return (
    <section id={seccion.id} className={cn('scroll-mt-24', print ? 'mb-7 break-inside-avoid-page' : 'mb-8')}>
      <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-gray-200">
        <span className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-lime-100 text-lime-700', print && 'print:bg-gray-100')}>
          <Icono size={16} />
        </span>
        <h2 className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
          {numero !== undefined && <span className="text-gray-400 font-bold mr-1.5">{numero}.</span>}
          {seccion.titulo}
        </h2>
      </div>
      <div className="space-y-3">
        {seccion.bloques.map((b, i) => <BloqueVista key={i} b={b} print={print} />)}
      </div>
    </section>
  );
}
