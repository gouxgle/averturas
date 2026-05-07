import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Upload, Search, Users, Phone, ArrowRight,
  TrendingUp, User, Building2, Hash, Clock, X, ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import type { Cliente, EstadoCliente } from '@/types';

const ESTADO_CFG: Record<EstadoCliente, { label: string; color: string; bg: string }> = {
  prospecto:  { label: 'Prospecto',  color: 'text-gray-600',    bg: 'bg-gray-100' },
  activo:     { label: 'Activo',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  recurrente: { label: 'Recurrente', color: 'text-blue-700',    bg: 'bg-blue-100' },
  inactivo:   { label: 'Inactivo',   color: 'text-amber-700',   bg: 'bg-amber-100' },
  perdido:    { label: 'Perdido',    color: 'text-red-700',     bg: 'bg-red-100' },
};

type LetraItem = { letra: string; total: number };

function nombreMostrado(c: Cliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(', ') || '—';
}

function ClienteRow({ cliente, onClick }: { cliente: Cliente; onClick: () => void }) {
  const esEmpresa = cliente.tipo_persona === 'juridica';
  const cat = cliente.categoria as any;
  const est = ESTADO_CFG[cliente.estado] ?? ESTADO_CFG.activo;
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        esEmpresa ? 'bg-blue-100' : 'bg-emerald-100')}>
        {esEmpresa
          ? <Building2 size={15} className="text-blue-600" />
          : <User size={15} className="text-emerald-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800 truncate">{nombreMostrado(cliente)}</p>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', est.bg, est.color)}>
            {est.label}
          </span>
          {cat && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
              style={{ backgroundColor: cat.color + '20', color: cat.color }}>
              {cat.nombre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {cliente.documento_nro && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Hash size={10} />{esEmpresa ? 'CUIT' : 'DNI'} {cliente.documento_nro}
            </span>
          )}
          {cliente.telefono && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Phone size={10} /> {cliente.telefono}
            </span>
          )}
          {cliente.localidad && (
            <span className="text-xs text-gray-400">{cliente.localidad}</span>
          )}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        {cliente.dias_sin_contacto != null && (
          <span className={cn('flex items-center gap-1 text-xs',
            cliente.dias_sin_contacto <= 7 ? 'text-emerald-600'
            : cliente.dias_sin_contacto <= 30 ? 'text-amber-600' : 'text-red-600')}>
            <Clock size={10} /> {cliente.dias_sin_contacto}d
          </span>
        )}
        <div className="text-right">
          <p className="text-xs text-gray-400">{(cliente as any).operaciones_count ?? 0} op.</p>
          {((cliente as any).valor_total_historico ?? 0) > 0 && (
            <p className="text-sm font-semibold text-gray-700">{formatCurrency((cliente as any).valor_total_historico)}</p>
          )}
        </div>
      </div>
      <ArrowRight size={13} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
    </button>
  );
}

export function Clientes() {
  const navigate = useNavigate();

  // Índice de letras (carga inicial)
  const [letras, setLetras] = useState<LetraItem[]>([]);
  const [loadingLetras, setLoadingLetras] = useState(true);

  // Caché de clientes por letra (solo carga cuando se abre la letra)
  const [cache, setCache] = useState<Map<string, Cliente[]>>(new Map());
  const [loadingLetra, setLoadingLetra] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  // Búsqueda server-side
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Cliente[] | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Totales del índice
  const total = letras.reduce((s, l) => s + l.total, 0);

  // Cargar índice de letras al montar
  useEffect(() => {
    api.get<LetraItem[]>('/clientes/letras').then(data => {
      setLetras(data);
      setLoadingLetras(false);
    });
  }, []);

  // Abrir/cerrar letra con carga lazy
  const toggleLetra = useCallback(async (letra: string) => {
    if (abierta === letra) {
      setAbierta(null);
      return;
    }
    setAbierta(letra);
    if (cache.has(letra)) return; // ya cargado

    setLoadingLetra(letra);
    const data = await api.get<Cliente[]>(`/clientes?letra=${encodeURIComponent(letra)}`);
    setCache(prev => new Map(prev).set(letra, data));
    setLoadingLetra(null);
  }, [abierta, cache]);

  // Búsqueda con debounce 350ms
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSearchResults(null);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    debounceRef.current = setTimeout(async () => {
      const data = await api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(value.trim())}`);
      setSearchResults(data);
      setLoadingSearch(false);
    }, 350);
  }, []);

  const isSearching = search.trim().length > 0;

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Users size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Clientes</h1>
            <p className="text-xs text-gray-500">
              {loadingLetras ? 'Cargando…' : `${total.toLocaleString('es-AR')} contactos · ${letras.length} grupos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/clientes/importar"
            className="flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Upload size={15} /> Importar
          </Link>
          <Link to="/clientes/nuevo"
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow-md transition-all">
            <Plus size={15} /> Nuevo cliente
          </Link>
        </div>
      </div>

      {/* Stats rápidas */}
      {!loadingLetras && letras.length > 0 && !isSearching && (
        <div className="flex flex-wrap gap-1.5">
          {letras.map(({ letra, total: t }) => (
            <button key={letra} onClick={() => toggleLetra(letra)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border',
                abierta === letra
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700'
              )}>
              {letra}
              <span className={cn('ml-1 font-normal', abierta === letra ? 'text-emerald-100' : 'text-gray-400')}>
                {t}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text"
          placeholder="Buscar por nombre, teléfono, DNI/CUIT, email, localidad…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm" />
        {isSearching && (
          <button onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Resultados de búsqueda */}
      {isSearching && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingSearch ? (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
              <Loader2 size={16} className="animate-spin" /> Buscando…
            </div>
          ) : !searchResults || searchResults.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-400">Sin resultados para "{search}"</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs text-gray-500">
                  {searchResults.length.toLocaleString('es-AR')} resultado{searchResults.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {searchResults.map(c => (
                  <ClienteRow key={c.id} cliente={c} onClick={() => navigate(`/clientes/${c.id}`)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Acordeón por letra */}
      {!isSearching && (
        <div className="space-y-1">
          {loadingLetras ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="px-4 py-3 animate-pulse flex gap-3 border-b border-gray-50">
                  <div className="w-8 h-5 bg-gray-100 rounded" />
                  <div className="w-20 h-5 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : letras.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-14 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400 mb-1">No hay clientes todavía</p>
              <Link to="/clientes/nuevo" className="text-sm text-emerald-600 hover:underline">
                Agregar el primero
              </Link>
            </div>
          ) : (
            letras.map(({ letra, total: t }) => {
              const isOpen = abierta === letra;
              const isLoading = loadingLetra === letra;
              const rows = cache.get(letra);
              return (
                <div key={letra} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Header de letra */}
                  <button
                    onClick={() => toggleLetra(letra)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                      isOpen ? 'bg-emerald-50 border-b border-emerald-100' : 'hover:bg-gray-50'
                    )}>
                    <span className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors',
                      isOpen ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                    )}>
                      {letra}
                    </span>
                    <span className="flex-1 text-sm text-gray-600">
                      <span className="font-medium">{t}</span>
                      <span className="text-gray-400"> contacto{t !== 1 ? 's' : ''}</span>
                    </span>
                    {isLoading
                      ? <Loader2 size={15} className="text-emerald-500 animate-spin shrink-0" />
                      : <ChevronRight size={15} className={cn(
                          'text-gray-400 shrink-0 transition-transform',
                          isOpen && 'rotate-90'
                        )} />
                    }
                  </button>

                  {/* Contenido expandido */}
                  {isOpen && rows && (
                    <div className="divide-y divide-gray-50">
                      {rows.map(c => (
                        <ClienteRow key={c.id} cliente={c} onClick={() => navigate(`/clientes/${c.id}`)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
