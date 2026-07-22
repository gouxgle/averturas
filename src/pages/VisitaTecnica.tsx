import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Ruler, Users, Search, X, Plus, Check, Loader2, Printer, ClipboardList, List,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { Cliente } from '@/types';

export function VisitaTecnica() {
  const navigate = useNavigate();

  const [clienteId, setClienteId]           = useState('');
  const [clienteNombre, setClienteNombre]   = useState('');
  const [clienteSearch, setClienteSearch]   = useState('');
  const [clientes, setClientes]             = useState<Cliente[]>([]);
  const [showClienteList, setShowClienteList] = useState(false);
  const [showQuickAdd, setShowQuickAdd]     = useState(false);
  const [qNombre, setQNombre]               = useState('');
  const [qApellido, setQApellido]           = useState('');
  const [qTelefono, setQTelefono]           = useState('');
  const [qDireccion, setQDireccion]         = useState('');
  const [qTelDup, setQTelDup]               = useState<Cliente | null>(null);
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [visitaId, setVisitaId]             = useState('');
  const [visitaNumero, setVisitaNumero]     = useState('');
  const [creandoVisita, setCreandoVisita]   = useState(false);

  useEffect(() => {
    if (!clienteId || visitaId) return;
    setCreandoVisita(true);
    api.post<{ id: string; numero: string }>('/visitas-tecnicas', { cliente_id: clienteId })
      .then(v => { setVisitaId(v.id); setVisitaNumero(v.numero); })
      .catch((e: any) => toast.error(e?.message ?? 'Error al crear la visita técnica'))
      .finally(() => setCreandoVisita(false));
  }, [clienteId, visitaId]);

  useEffect(() => {
    const q = clienteSearch.trim();
    if (!q) { setClientes([]); return; }
    const t = setTimeout(() => {
      api.get<Cliente[]>(`/clientes?search=${encodeURIComponent(q)}`)
        .then(setClientes).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [clienteSearch]);

  function nombreCliente(c: Cliente) {
    return c.tipo_persona === 'juridica'
      ? (c.razon_social ?? '')
      : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
  }

  function seleccionarCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteNombre(nombreCliente(c));
    setClienteSearch('');
    setShowClienteList(false);
    setShowQuickAdd(false);
  }

  async function checkTelDup(tel: string) {
    setQTelDup(null);
    const digits = tel.replace(/\D/g, '');
    if (digits.length < 8) return;
    try {
      const r = await api.get<{ existe: boolean; cliente?: Cliente }>(`/clientes/validar-telefono?telefono=${digits}`);
      if (r.existe && r.cliente) setQTelDup(r.cliente);
    } catch { /* no bloqueante */ }
  }

  async function crearClienteRapido() {
    if (!qNombre.trim() && !qApellido.trim()) {
      toast.error('Ingresá al menos el nombre'); return;
    }
    setCreandoCliente(true);
    try {
      const cliente = await api.post<Cliente>('/clientes', {
        tipo_persona: 'fisica',
        nombre: qNombre.trim() || undefined,
        apellido: qApellido.trim() || undefined,
        telefono: qTelefono.trim() || undefined,
        direccion: qDireccion.trim() || undefined,
      });
      seleccionarCliente(cliente);
      setQNombre(''); setQApellido(''); setQTelefono(''); setQDireccion(''); setQTelDup(null);
      toast.success('Cliente creado');
    } catch (e: any) {
      toast.error(e?.message ?? 'Error al crear cliente');
    } finally {
      setCreandoCliente(false);
    }
  }

  function imprimir() {
    window.open(`/imprimir/visita-tecnica?visita_id=${visitaId}`, '_blank');
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} className="text-gray-500"/>
          </button>
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <Ruler size={18} className="text-slate-600"/>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Visita técnica</h1>
            <p className="text-xs text-gray-400">Elegí el cliente y generá el formulario para relevamiento in situ</p>
          </div>
        </div>
        <Link to="/presupuestos/visitas-tecnicas"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:underline shrink-0">
          <List size={13}/> Ver visitas
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Users size={13}/> Cliente
        </p>
        {clienteId ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{clienteNombre}</span>
            <button onClick={() => { setClienteId(''); setClienteNombre(''); }}
              className="p-1 hover:bg-white rounded"><X size={13} className="text-gray-400"/></button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl">
              <Search size={14} className="text-gray-300 shrink-0"/>
              <input
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true); }}
                onFocus={() => setShowClienteList(true)}
                onBlur={() => setTimeout(() => setShowClienteList(false), 150)}
                placeholder="Buscar por nombre, teléfono o DNI..."
                className="flex-1 text-sm focus:outline-none"
              />
            </div>
            {showClienteList && clienteSearch && (
              <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {clientes.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
                ) : clientes.slice(0, 8).map(c => (
                  <button key={c.id} onMouseDown={() => seleccionarCliente(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{nombreCliente(c)}</p>
                    {(c.telefono || c.direccion) && (
                      <p className="text-xs text-gray-400">{[c.telefono, c.direccion].filter(Boolean).join(' · ')}</p>
                    )}
                  </button>
                ))}
                <button onMouseDown={() => { setShowQuickAdd(true); setQNombre(clienteSearch); }}
                  className="w-full text-left px-4 py-2.5 text-slate-600 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5">
                  <Plus size={13}/> Cliente nuevo
                </button>
              </div>
            )}
            {!showQuickAdd && !clienteSearch && (
              <button onClick={() => setShowQuickAdd(true)}
                className="mt-2 text-xs text-slate-600 hover:underline font-semibold flex items-center gap-1">
                <Plus size={12}/> Cliente nuevo
              </button>
            )}
          </div>
        )}

        {/* Alta rápida inline — incluye domicilio, dato clave para la visita */}
        {showQuickAdd && !clienteId && (
          <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={qNombre} onChange={e => setQNombre(e.target.value)} placeholder="Nombre"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"/>
              <input value={qApellido} onChange={e => setQApellido(e.target.value)} placeholder="Apellido"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"/>
            </div>
            <input value={qTelefono}
              onChange={e => setQTelefono(e.target.value)}
              onBlur={() => checkTelDup(qTelefono)}
              placeholder="Teléfono"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"/>
            <input value={qDireccion} onChange={e => setQDireccion(e.target.value)}
              placeholder="Domicilio de la visita"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"/>
            {qTelDup && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <span>Ya existe: <strong>{nombreCliente(qTelDup)}</strong></span>
                <button onClick={() => seleccionarCliente(qTelDup)} className="font-bold hover:underline shrink-0">Usar este</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={crearClienteRapido} disabled={creandoCliente}
                className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
                {creandoCliente ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                Crear y continuar
              </button>
              <button onClick={() => setShowQuickAdd(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-100">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {visitaId && (
        <p className="text-xs text-center text-gray-400">Visita <strong className="text-gray-600">{visitaNumero}</strong> guardada</p>
      )}

      <button onClick={imprimir} disabled={!clienteId || !visitaId || creandoVisita}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
        {creandoVisita ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} Imprimir formulario de visita técnica
      </button>

      {visitaId && (
        <button onClick={() => navigate(`/presupuestos/visitas-tecnicas/${visitaId}`)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold transition-colors">
          <ClipboardList size={15}/> Cargar datos relevados ahora
        </button>
      )}
    </div>
  );
}
