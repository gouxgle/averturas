import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ruler, Plus, ChevronRight, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { SectionHero } from '@/components/SectionHero';

interface VTCliente {
  nombre: string | null; apellido: string | null;
  razon_social: string | null; tipo_persona: string;
}
interface VisitaTecnicaRow {
  id: string; numero: string; estado: 'pendiente' | 'relevada' | 'convertida' | 'cancelada';
  fecha_visita: string | null; created_at: string; items_total: number;
  cliente: VTCliente;
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pendiente:  { label: 'Pendiente de relevar', cls: 'bg-gray-100 text-gray-600' },
  relevada:   { label: 'Relevada',             cls: 'bg-sky-100 text-sky-700' },
  convertida: { label: 'Convertida a presupuesto', cls: 'bg-emerald-100 text-emerald-700' },
  cancelada:  { label: 'Cancelada',            cls: 'bg-red-100 text-red-500' },
};

function ncl(c: VTCliente) {
  if (c.tipo_persona === 'juridica') return c.razon_social ?? '—';
  return [c.apellido, c.nombre].filter(Boolean).join(' ') || '—';
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function VisitasTecnicas() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<VisitaTecnicaRow[]>([]);
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = estado ? `?estado=${estado}` : '';
    api.get<VisitaTecnicaRow[]>(`/visitas-tecnicas${qs}`)
      .then(setVisitas)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [estado]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <SectionHero
        section="presupuestos"
        icon={Ruler}
        title="Visitas técnicas"
        sub="Relevamientos en el sitio, a la espera de convertirse en presupuesto"
        actions={
          <Link to="/presupuestos/visita-tecnica"
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all">
            <Plus size={16} /> Nueva visita
          </Link>
        }
      />

      <div className="flex items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        {['', 'pendiente', 'relevada', 'convertida', 'cancelada'].map(e => (
          <button key={e} onClick={() => setEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${estado === e ? 'bg-slate-800 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            {e === '' ? 'Todas' : ESTADO_BADGE[e].label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 p-6 text-center">Cargando...</p>
        ) : visitas.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">No hay visitas técnicas registradas</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Fecha visita</th>
                <th className="px-4 py-3">Ítems</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visitas.map(v => {
                const badge = ESTADO_BADGE[v.estado];
                return (
                  <tr key={v.id} onClick={() => navigate(`/presupuestos/visitas-tecnicas/${v.id}`)}
                    className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700">{v.numero}</td>
                    <td className="px-4 py-3 text-gray-700">{ncl(v.cliente)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtFecha(v.fecha_visita)}</td>
                    <td className="px-4 py-3 text-gray-500">{v.items_total}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={16} className="text-gray-300 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
