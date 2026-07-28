import { useState, useEffect, useRef } from 'react';
import { StickyNote, X, Check, Trash2, RotateCcw, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Comentario {
  id: string;
  texto: string;
  resuelto: boolean;
  resuelto_at: string | null;
  created_at: string;
  created_by_nombre: string | null;
  resuelto_by_nombre: string | null;
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function BuzonComentarios() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Comentario[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verResueltos, setVerResueltos] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = () => {
    api.get<Comentario[]>('/comentarios').then(setItems).catch(() => {});
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (open) load(); }, [open]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const pendientes = items.filter(i => !i.resuelto);
  const resueltos = items.filter(i => i.resuelto);

  async function agregar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const nuevo = await api.post<Comentario>('/comentarios', { texto: texto.trim() });
      setItems(prev => [nuevo, ...prev]);
      setTexto('');
    } catch {
      toast.error('No se pudo guardar el comentario');
    } finally {
      setEnviando(false);
    }
  }

  async function toggleResuelto(item: Comentario) {
    try {
      const actualizado = await api.patch<Comentario>(`/comentarios/${item.id}/resolver`, { resuelto: !item.resuelto });
      setItems(prev => prev.map(i => i.id === item.id ? actualizado : i));
    } catch {
      toast.error('No se pudo actualizar');
    }
  }

  async function eliminar(id: string) {
    try {
      await api.delete(`/comentarios/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      toast.error('No se pudo eliminar');
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-4 left-4 z-40">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[320px] max-h-[70vh] bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-amber-50">
            <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <StickyNote size={14} className="text-amber-500" /> Buzón de comentarios
            </span>
            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-white/60">
              <X size={14} />
            </button>
          </div>

          <div className="p-3 border-b border-gray-100 flex gap-2">
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(); }}
              placeholder="Escribí un comentario..."
              rows={2}
              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
            />
            <button onClick={agregar} disabled={enviando || !texto.trim()}
              className="shrink-0 w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center self-end">
              <Send size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {pendientes.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Sin comentarios pendientes</p>
            )}
            {pendientes.map(item => (
              <div key={item.id} className="px-3 py-2.5 border-b border-gray-50 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">{item.texto}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {item.created_by_nombre ?? 'Alguien'} · {fmtFecha(item.created_at)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => toggleResuelto(item)} title="Marcar resuelto"
                    className="p-1 text-gray-300 hover:text-emerald-600 rounded hover:bg-emerald-50">
                    <Check size={13} />
                  </button>
                  <button onClick={() => eliminar(item.id)} title="Eliminar"
                    className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            {resueltos.length > 0 && (
              <div>
                <button onClick={() => setVerResueltos(v => !v)}
                  className="w-full text-left px-3 py-2 text-[10px] font-semibold text-gray-400 hover:bg-gray-50">
                  {verResueltos ? '▲' : '▼'} Resueltos ({resueltos.length})
                </button>
                {verResueltos && resueltos.map(item => (
                  <div key={item.id} className="px-3 py-2 border-t border-gray-50 flex items-start gap-2 opacity-60">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 line-through whitespace-pre-wrap break-words">{item.texto}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Resuelto por {item.resuelto_by_nombre ?? '—'} · {item.resuelto_at ? fmtFecha(item.resuelto_at) : ''}
                      </p>
                    </div>
                    <button onClick={() => toggleResuelto(item)} title="Reabrir"
                      className="shrink-0 p-1 text-gray-300 hover:text-amber-600 rounded hover:bg-amber-50">
                      <RotateCcw size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-500 shadow-lg flex items-center justify-center transition-colors"
        title="Buzón de comentarios"
      >
        <StickyNote size={20} className="text-white" />
        {pendientes.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {pendientes.length}
          </span>
        )}
      </button>
    </div>
  );
}
