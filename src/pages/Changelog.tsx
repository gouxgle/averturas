import { useState, useEffect } from 'react';
import { History, Sparkles, Wrench, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SectionHero } from '@/components/SectionHero';

interface Cambio {
  id: string;
  fecha: string;
  titulo: string;
  descripcion: string | null;
  categoria: 'feature' | 'fix' | 'mejora';
}

const CATEGORIA_CFG: Record<Cambio['categoria'], { label: string; cls: string; Icon: typeof Sparkles }> = {
  feature: { label: 'Nuevo',    cls: 'bg-emerald-100 text-emerald-700', Icon: Sparkles },
  fix:     { label: 'Arreglo',  cls: 'bg-red-100 text-red-600',         Icon: Wrench },
  mejora:  { label: 'Mejora',   cls: 'bg-sky-100 text-sky-700',         Icon: TrendingUp },
};

function fmtFecha(iso: string) {
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function Changelog() {
  const [items, setItems] = useState<Cambio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Cambio[]>('/changelog')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Agrupar por fecha, preservando el orden (más reciente primero) que ya viene del backend
  const grupos: { fecha: string; items: Cambio[] }[] = [];
  for (const it of items) {
    const grupo = grupos[grupos.length - 1];
    if (grupo && grupo.fecha === it.fecha) grupo.items.push(it);
    else grupos.push({ fecha: it.fecha, items: [it] });
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <SectionHero
        section="sistema"
        icon={History}
        title="Novedades"
        sub="Registro cronológico de cambios del sistema — para saber qué se modificó y probarlo"
      />

      {loading ? (
        <p className="text-sm text-gray-600 text-center py-10">Cargando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-10">Todavía no hay cambios registrados</p>
      ) : (
        <div className="space-y-6">
          {grupos.map(grupo => (
            <div key={grupo.fecha}>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 capitalize">
                {fmtFecha(grupo.fecha)}
              </p>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md divide-y divide-gray-100">
                {grupo.items.map(item => {
                  const cfg = CATEGORIA_CFG[item.categoria];
                  return (
                    <div key={item.id} className="p-4 flex items-start gap-3">
                      <span className={cn('shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center', cfg.cls)}>
                        <cfg.Icon size={13} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900">{item.titulo}</p>
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', cfg.cls)}>{cfg.label}</span>
                        </div>
                        {item.descripcion && (
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.descripcion}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
