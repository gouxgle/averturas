import { useState } from 'react';
import { History, ChevronDown, ChevronRight, Loader2, Copy, Printer, GitCompare } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { ComparadorRevisiones } from '@/components/ComparadorRevisiones';
import type { DiffSnapshot } from '@/lib/diffProforma';

interface Revision {
  id: string;
  revision: number;
  token: string;
  enviada_at: string;
  canal: string | null;
  aprobada_at: string | null;
  rechazada_at: string | null;
  enviada_por_nombre: string | null;
  precio_total: number;
}

const CANAL_LABEL: Record<string, string> = {
  link: 'Link', whatsapp: 'WhatsApp', email: 'Email', backfill: 'Histórico',
};

// Historial de revisiones ENVIADAS al cliente — hermano de VersionesPresupuesto
// (que muestra ediciones internas). Cada fila acá es un envío real: link,
// WhatsApp o email, con su propio token congelado. Ver plan de versionado.
export function RevisionesEnviadas({ operacionId, numero = '' }: { operacionId: string; numero?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [revisiones, setRevisiones] = useState<Revision[]>([]);
  const [comparando, setComparando] = useState<{ a: DiffSnapshot; b: DiffSnapshot; labelA: string; labelB: string; numero: string } | null>(null);
  const [cargandoComparar, setCargandoComparar] = useState<number | null>(null);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !cargado) {
      setLoading(true);
      api.get<Revision[]>(`/operaciones/${operacionId}/revisiones`)
        .then(setRevisiones)
        .catch(() => setRevisiones([]))
        .finally(() => { setLoading(false); setCargado(true); });
    }
  }

  function copiarLink(token: string) {
    const url = `${window.location.origin}/p/${token}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Link copiado'))
      .catch(() => toast.error('No se pudo copiar'));
  }

  async function compararConAnterior(rev: Revision, anterior: Revision) {
    setCargandoComparar(rev.revision);
    try {
      const [a, b] = await Promise.all([
        api.get<{ snapshot: DiffSnapshot }>(`/operaciones/${operacionId}/revisiones/${anterior.revision}`),
        api.get<{ snapshot: DiffSnapshot }>(`/operaciones/${operacionId}/revisiones/${rev.revision}`),
      ]);
      setComparando({ a: a.snapshot, b: b.snapshot, labelA: `Rev. ${anterior.revision}`, labelB: `Rev. ${rev.revision}`, numero });
    } catch {
      toast.error('No se pudo cargar la comparación');
    } finally {
      setCargandoComparar(null);
    }
  }

  const maxRevision = revisiones.length ? Math.max(...revisiones.map(r => r.revision)) : 0;

  return (
    <div className="px-5 pb-4">
      <button type="button" onClick={toggleOpen}
        className="w-full flex items-center gap-2 py-2 text-left">
        <History size={13} className="text-emerald-600" />
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex-1">
          Revisiones enviadas al cliente{cargado && revisiones.length > 0 ? ` (${revisiones.length})` : ''}
        </p>
        {open ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} className="text-gray-600" />}
      </button>

      {open && (
        loading ? (
          <div className="py-4 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-600" /></div>
        ) : revisiones.length === 0 ? (
          <p className="text-xs text-gray-600 py-2">Todavía no se compartió esta proforma con el cliente.</p>
        ) : (
          <div className="space-y-1.5 mt-1">
            {revisiones.map((r, idx) => {
              const anterior = revisiones[idx + 1]; // vienen DESC; la siguiente en la lista es la anterior en el tiempo
              const esVigente = r.revision === maxRevision;
              return (
                <div key={r.id} className="border border-gray-200 rounded-xl px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-800 shrink-0">Rev. {r.revision}</span>
                      {esVigente && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">Vigente</span>
                      )}
                      {r.aprobada_at && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">Aprobada</span>
                      )}
                      {r.rechazada_at && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">Rechazada</span>
                      )}
                      <span className="text-[11px] text-gray-600 truncate">
                        {formatDate(r.enviada_at)} · {CANAL_LABEL[r.canal ?? ''] ?? r.canal ?? '—'}
                        {r.enviada_por_nombre ? ` · ${r.enviada_por_nombre}` : ''}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 shrink-0">{formatCurrency(Number(r.precio_total))}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <button type="button" onClick={() => copiarLink(r.token)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                      <Copy size={11} /> Copiar link
                    </button>
                    <button type="button"
                      onClick={() => window.open(`/imprimir/presupuesto/${operacionId}?revision=${r.revision}`, '_blank')}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
                      <Printer size={11} /> PDF
                    </button>
                    {anterior && (
                      <button type="button" onClick={() => compararConAnterior(r, anterior)} disabled={cargandoComparar === r.revision}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border',
                          'text-violet-700 border-violet-200 hover:bg-violet-50 disabled:opacity-60',
                        )}>
                        {cargandoComparar === r.revision ? <Loader2 size={11} className="animate-spin" /> : <GitCompare size={11} />}
                        Comparar con Rev. {anterior.revision}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {comparando && (
        <ComparadorRevisiones
          a={comparando.a} b={comparando.b} labelA={comparando.labelA} labelB={comparando.labelB}
          numero={comparando.numero}
          onClose={() => setComparando(null)}
        />
      )}
    </div>
  );
}
