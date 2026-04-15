import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, Plus, MessageCircle, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { Cliente, Operacion } from '@/types';

const ESTADO_COLOR: Record<string, string> = {
  presupuesto:   'bg-gray-100 text-gray-700',
  enviado:       'bg-blue-100 text-blue-700',
  aprobado:      'bg-green-100 text-green-700',
  en_produccion: 'bg-amber-100 text-amber-700',
  listo:         'bg-teal-100 text-teal-700',
  instalado:     'bg-purple-100 text-purple-700',
  entregado:     'bg-emerald-100 text-emerald-700',
  cancelado:     'bg-red-100 text-red-700',
};

const ESTADO_LABEL: Record<string, string> = {
  presupuesto: 'Presupuesto', enviado: 'Enviado', aprobado: 'Aprobado',
  en_produccion: 'En producción', listo: 'Listo', instalado: 'Instalado',
  entregado: 'Entregado', cancelado: 'Cancelado',
};

interface Interaccion {
  id: string;
  tipo: string;
  descripcion: string;
  created_at: string;
  created_by_usuario?: { nombre: string } | null;
}

interface ClienteConDetalle extends Cliente {
  operaciones: Operacion[];
  interacciones: Interaccion[];
}

export function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ClienteConDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notaTexto, setNotaTexto] = useState('');
  const [savingNota, setSavingNota] = useState(false);

  async function load() {
    if (!id) return;
    const result = await api.get<ClienteConDetalle>(`/clientes/${id}`);
    setData(result);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function agregarNota() {
    if (!notaTexto.trim() || !id) return;
    setSavingNota(true);
    await api.post('/interacciones', { cliente_id: id, tipo: 'nota', descripcion: notaTexto.trim() });
    setNotaTexto('');
    await load();
    setSavingNota(false);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-gray-400">Cliente no encontrado</p>
        <button onClick={() => navigate('/clientes')} className="text-brand-600 text-sm mt-2 hover:underline">Volver</button>
      </div>
    );
  }

  const { operaciones, interacciones, ...cliente } = data;
  const nombreCompleto = `${cliente.nombre}${cliente.apellido ? ` ${cliente.apellido}` : ''}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{nombreCompleto}</h1>
          {cliente.razon_social && <p className="text-sm text-gray-500">{cliente.razon_social}</p>}
        </div>
        <Link
          to={`/operaciones/nueva?cliente_id=${cliente.id}&cliente_nombre=${encodeURIComponent(nombreCompleto)}`}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm"
        >
          <Plus size={15} /> Nueva operación
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            {(cliente.categoria as any) && (
              <span
                className="inline-block text-xs px-2.5 py-1 rounded-full font-medium mb-1"
                style={{
                  backgroundColor: (cliente.categoria as any).color + '20',
                  color: (cliente.categoria as any).color,
                }}
              >
                {(cliente.categoria as any).nombre}
              </span>
            )}
            {cliente.telefono && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={14} className="text-gray-400 shrink-0" />
                <a href={`tel:${cliente.telefono}`} className="hover:text-brand-600">{cliente.telefono}</a>
              </div>
            )}
            {cliente.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <a href={`mailto:${cliente.email}`} className="hover:text-brand-600 truncate">{cliente.email}</a>
              </div>
            )}
            {(cliente.direccion || cliente.localidad) && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <span>{[cliente.direccion, cliente.localidad].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {cliente.notas && (
              <p className="text-xs text-gray-500 border-t border-gray-100 pt-3 mt-2">{cliente.notas}</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Historial</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Operaciones</span>
              <span className="font-semibold text-gray-800">{cliente.operaciones_count ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Valor total</span>
              <span className="font-semibold text-gray-800">{formatCurrency(cliente.valor_total_historico ?? 0)}</span>
            </div>
            {cliente.ultima_interaccion && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Último contacto</span>
                <span className="text-gray-700">{formatDate(cliente.ultima_interaccion)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <ClipboardList size={15} className="text-brand-500" />
              <h2 className="text-sm font-semibold text-gray-800">Operaciones</h2>
              <span className="ml-auto text-xs text-gray-400">{operaciones.length}</span>
            </div>
            {operaciones.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">Sin operaciones todavía</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {operaciones.map(op => (
                  <Link
                    key={op.id}
                    to={`/operaciones/${op.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{op.numero}</p>
                      <p className="text-xs text-gray-400">{formatDate(op.created_at)}</p>
                    </div>
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', ESTADO_COLOR[op.estado])}>
                      {ESTADO_LABEL[op.estado] ?? op.estado}
                    </span>
                    <p className="text-sm font-semibold text-gray-700 w-24 text-right">{formatCurrency(op.precio_total)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <MessageCircle size={15} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800">Notas e interacciones</h2>
            </div>
            <div className="px-5 py-4 border-b border-gray-100 flex gap-3">
              <textarea
                value={notaTexto}
                onChange={e => setNotaTexto(e.target.value)}
                placeholder="Agregar una nota..."
                rows={2}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={agregarNota}
                disabled={savingNota || !notaTexto.trim()}
                className="self-end px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm rounded-lg"
              >
                {savingNota ? '...' : 'Guardar'}
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {interacciones.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-gray-400">Sin notas todavía</p>
                </div>
              ) : interacciones.map(int => (
                <div key={int.id} className="px-5 py-3.5">
                  <p className="text-sm text-gray-700">{int.descripcion}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(int.created_at)}
                    {int.created_by_usuario?.nombre ? ` · ${int.created_by_usuario.nombre}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
