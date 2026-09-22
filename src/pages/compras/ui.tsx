import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, FileText, ImagePlus, RefreshCw, Trash2, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BadgeProveedor } from '@/components/BadgeProveedor';
import { esPdf, subirAdjunto, resumenEspecificaciones, type Especificaciones, type ProveedorMin } from './tipos';

export const inpCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white disabled:bg-gray-50 disabled:text-gray-500';
export const lblCls = 'block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1';
export const btnPrimario = 'inline-flex items-center justify-center gap-2 bg-lime-600 hover:bg-lime-700 text-white text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecundario = 'inline-flex items-center justify-center gap-2 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPeligro = 'inline-flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 h-11 sm:h-10 rounded-xl transition-colors disabled:opacity-50';

export function Badge({ label, cls, className }: { label: string; cls: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-transparent whitespace-nowrap', cls, className)}>
      {label}
    </span>
  );
}

/** Contenedor de modal de detalle (convención del repo: header con número + estado + acciones + X). */
export function ModalShell({ icon, iconCls, titulo, subtitulo, badges, acciones, onClose, children, ancho = 'sm:max-w-3xl', pie }: {
  icon: ReactNode;
  iconCls?: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  badges?: ReactNode;
  acciones?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  ancho?: string;
  pie?: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cn('bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-h-[94dvh] sm:max-h-[90dvh] flex flex-col', ancho)}>
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-gray-200 shrink-0">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconCls ?? 'bg-lime-50 text-lime-700')}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-gray-900 text-base leading-tight">{titulo}</p>
              {badges}
            </div>
            {subtitulo && <p className="text-xs text-gray-600 mt-0.5">{subtitulo}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {acciones}
            <button onClick={onClose} className="w-11 h-11 sm:w-9 sm:h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {children}
        </div>
        {/* pl-14 en mobile: el buzón de comentarios es `fixed bottom-4 left-4` y flota por
            encima de todo (mismo criterio que ModalCatalogoProductos) */}
        {pie && <div className="shrink-0 border-t border-gray-200 p-3 sm:p-4 pl-16 sm:pl-4 bg-gray-50 rounded-b-2xl">{pie}</div>}
      </div>
    </div>
  );
}

export function Cargando() {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8"><RefreshCw className="animate-spin text-lime-600" /></div>
    </div>
  );
}

/** Pantalla roja de confirmación destructiva dentro del modal (no window.confirm). */
export function ConfirmacionRoja({ titulo, texto, conMotivo, labelConfirmar = 'Confirmar', onConfirmar, onCancelar, cargando }: {
  titulo: string; texto?: string; conMotivo?: boolean; labelConfirmar?: string;
  onConfirmar: (motivo: string) => void; onCancelar: () => void; cargando?: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
      <p className="text-sm font-bold text-red-800">{titulo}</p>
      {texto && <p className="text-sm text-red-700">{texto}</p>}
      {conMotivo && (
        <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" className={inpCls} autoFocus />
      )}
      <div className="flex gap-2">
        <button onClick={() => onConfirmar(motivo.trim())} disabled={cargando || (conMotivo && !motivo.trim())}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold h-11 sm:h-10 rounded-xl disabled:opacity-50">
          {labelConfirmar}
        </button>
        <button onClick={onCancelar} disabled={cargando} className={cn(btnSecundario, 'flex-1')}>Volver</button>
      </div>
    </div>
  );
}

export function Seccion({ titulo, children, accion, className }: { titulo: string; children: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  );
}

/** Chips de la ficha técnica de un ítem. */
export function FichaTecnica({ e, className }: { e: Especificaciones | null | undefined; className?: string }) {
  const txt = resumenEspecificaciones(e);
  if (!txt) return null;
  return <p className={cn('text-[11px] text-gray-600 leading-snug', className)}>{txt}</p>;
}

/** Miniaturas de adjuntos (imágenes y PDFs) con quitar opcional. */
export function AdjuntosGrid({ urls, onRemove, size = 'md' }: { urls: string[]; onRemove?: (url: string) => void; size?: 'sm' | 'md' }) {
  if (!urls?.length) return null;
  const dim = size === 'sm' ? 'w-12 h-12' : 'w-20 h-20';
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map(u => (
        <div key={u} className={cn('relative group rounded-lg border border-gray-200 overflow-hidden bg-gray-50', dim)}>
          <a href={u} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            {esPdf(u)
              ? <div className="w-full h-full flex flex-col items-center justify-center text-red-600 gap-0.5"><FileText size={size === 'sm' ? 16 : 22} /><span className="text-[9px] font-bold">PDF</span></div>
              : <img src={u} alt="" className="w-full h-full object-cover" />}
          </a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(u)} title="Quitar"
              className="absolute top-0.5 right-0.5 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 sm:transition-opacity">
              <X size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Dropzone de adjuntos (click / arrastrar / pegar), sube a /compras/adjuntos. */
export function DropzoneAdjuntos({ onAdd, compacto, accept = 'image/*,application/pdf' }: { onAdd: (url: string) => void; compacto?: boolean; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function subir(files: FileList | File[]) {
    setSubiendo(true);
    try {
      for (const f of Array.from(files)) {
        const r = await subirAdjunto(f);
        onAdd(r.url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally { setSubiendo(false); }
  }

  return (
    <div tabIndex={0}
      onPaste={e => { const fs = Array.from(e.clipboardData.files ?? []); if (fs.length) { e.preventDefault(); subir(fs); } }}
      onDrop={e => { e.preventDefault(); if (e.dataTransfer.files?.length) subir(e.dataTransfer.files); }}
      onDragOver={e => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className={cn('flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-lime-400 hover:bg-lime-50/40 transition-colors focus:outline-none focus:ring-2 focus:ring-lime-300',
        compacto ? 'py-2 px-3' : 'py-4 px-3')}>
      {subiendo ? <RefreshCw size={18} className="text-gray-500 animate-spin" /> : <ImagePlus size={18} className="text-gray-500" />}
      <p className="text-xs text-gray-600 text-center">{compacto ? 'Agregar foto o PDF' : 'Fotos, planos o PDF — hacé click, arrastrá o pegá (Ctrl+V)'}</p>
      <input ref={ref} type="file" accept={accept} multiple className="hidden"
        onChange={e => { if (e.target.files?.length) subir(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/** Lista de proveedores con búsqueda y selección simple o múltiple. */
export function SelectorProveedores({ proveedores, seleccionados, onChange, multiple = true, sugeridoId, max = 8 }: {
  proveedores: ProveedorMin[];
  seleccionados: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  sugeridoId?: string | null;
  max?: number;
}) {
  const [q, setQ] = useState('');
  const lista = proveedores
    .filter(p => !q.trim() || p.nombre.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.id === sugeridoId ? -1 : b.id === sugeridoId ? 1 : a.nombre.localeCompare(b.nombre)));

  function toggle(id: string) {
    if (!multiple) return onChange([id]);
    if (seleccionados.includes(id)) onChange(seleccionados.filter(x => x !== id));
    else if (seleccionados.length < max) onChange([...seleccionados, id]);
    else toast.info(`Máximo ${max} proveedores`);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proveedor…" className={cn(inpCls, 'pl-8')} />
      </div>
      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
        {lista.length === 0 && <p className="text-sm text-gray-500 p-3">Sin proveedores</p>}
        {lista.map(p => {
          const sel = seleccionados.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => toggle(p.id)}
              className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-lime-50/60 transition-colors min-h-11', sel && 'bg-lime-50')}>
              <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                multiple ? 'rounded-md' : 'rounded-full', sel ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-300 bg-white')}>
                {sel && <Check size={12} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{p.nombre}</span>
                  <BadgeProveedor proveedor={p} />
                  {p.id === sugeridoId && <span className="text-[10px] font-semibold text-lime-700 bg-lime-100 rounded-full px-1.5">sugerido</span>}
                </div>
                <p className="text-[11px] text-gray-500 truncate">
                  {[p.contacto, p.telefono, p.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </p>
              </div>
              {!p.telefono && !p.email && <span className="text-[10px] text-amber-700 shrink-0">sin contacto</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BotonEliminar({ onClick, title = 'Quitar' }: { onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0">
      <Trash2 size={14} />
    </button>
  );
}

/** Paginación simple (misma que la lista vieja de pedidos). */
export function Paginacion({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (n: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 flex-wrap gap-2">
      <span className="text-xs text-gray-600">Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de {total}</span>
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => onPage(n)}
            className={cn('w-8 h-8 rounded-lg text-xs font-semibold', n === page ? 'bg-lime-600 text-white' : 'text-gray-600 hover:bg-gray-100')}>{n}</button>
        ))}
      </div>
    </div>
  );
}
