import { useEffect, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface Contacto { id: string; nombre: string; detalle: string }

interface ClienteBusqueda {
  id: string; tipo_persona: string | null; nombre: string | null; apellido: string | null; razon_social: string | null;
  telefono: string | null; documento_nro: string | null; localidad: string | null;
}
interface Proveedor { id: string; nombre: string; telefono: string | null; contacto?: string | null; activo?: boolean }

const nombreCliente = (c: ClienteBusqueda) =>
  c.tipo_persona === 'juridica' ? (c.razon_social ?? '—') : [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
const detalle = (...xs: (string | null | undefined)[]) => xs.filter(x => x?.trim()).join(' · ');
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  tipo: 'cliente' | 'proveedor';
  valor: Contacto | null;
  onChange: (c: Contacto | null) => void;
  id?: string;
  autoFocus?: boolean;
}

// Buscador de la agenda de contactos: el cliente se busca en el servidor (nombre, DNI, teléfono…)
// y el proveedor en la lista activa. Elegido, queda como ficha con su teléfono para no confundirlo
// con otro del mismo nombre; la X lo quita para buscar otro.
export function BuscadorContacto({ tipo, valor, onChange, id, autoFocus }: Props) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Contacto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);

  useEffect(() => {
    if (tipo !== 'proveedor') return;
    api.get<Proveedor[]>('/catalogo/proveedores').then(setProveedores).catch(() => setProveedores([]));
  }, [tipo]);

  useEffect(() => {
    const texto = q.trim();
    if (tipo === 'proveedor') {
      if (!proveedores) return;
      const t = sinTildes(texto);
      const filas = proveedores.filter(p => p.activo !== false && (!t || sinTildes(`${p.nombre} ${p.contacto ?? ''} ${p.telefono ?? ''}`).includes(t)));
      setResultados(filas.slice(0, 30).map(p => ({ id: p.id, nombre: p.nombre, detalle: detalle(p.contacto, p.telefono) })));   // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    if (texto.length < 2) { setResultados([]); return; }
    setBuscando(true);
    const h = setTimeout(() => {
      api.get<ClienteBusqueda[]>(`/clientes?search=${encodeURIComponent(texto)}`)
        .then(cs => setResultados(cs.slice(0, 10).map(c => ({
          id: c.id, nombre: nombreCliente(c), detalle: detalle(c.telefono, c.documento_nro && `DNI ${c.documento_nro}`, c.localidad),
        }))))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 250);
    return () => clearTimeout(h);
  }, [q, tipo, proveedores]);

  if (valor) {
    return (
      <div className="flex items-center gap-2 min-h-10 px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50" data-testid={`contacto-${tipo}`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{valor.nombre}</p>
          {valor.detalle && <p className="text-[11px] text-gray-600 truncate">{valor.detalle}</p>}
        </div>
        <button type="button" onClick={() => { onChange(null); setQ(''); setAbierto(true); }}
          className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-600" aria-label={`Quitar ${tipo}`}>
          <X size={16} />
        </button>
      </div>
    );
  }

  const placeholder = tipo === 'cliente' ? 'Buscar cliente por nombre, DNI o teléfono' : 'Buscar proveedor';
  const vacio = tipo === 'cliente'
    ? (q.trim().length < 2 ? 'Escribí al menos 2 letras' : 'No hay clientes con ese dato')
    : 'No hay proveedores con ese nombre';

  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input id={id} value={q} autoFocus={autoFocus} autoComplete="off" placeholder={placeholder}
        onChange={e => { setQ(e.target.value); setAbierto(true); }}
        onFocus={e => { setAbierto(true); e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }); }} onBlur={() => setAbierto(false)}
        className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-300 bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      {buscando && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      {abierto && (tipo === 'proveedor' || q.trim()) && (
        <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg" role="listbox">
          {resultados.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-gray-500">{buscando ? 'Buscando…' : vacio}</li>
          ) : resultados.map(r => (
            // onMouseDown y no onClick: el blur del input cerraría la lista antes del click
            <li key={r.id} role="option" aria-selected={false}
              onMouseDown={e => { e.preventDefault(); onChange(r); setQ(''); setAbierto(false); }}
              className="px-3 py-2 cursor-pointer hover:bg-orange-50 border-b border-gray-100 last:border-0">
              <p className={cn('text-sm font-semibold text-gray-900 truncate')}>{r.nombre}</p>
              {r.detalle && <p className="text-[11px] text-gray-600 truncate">{r.detalle}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
