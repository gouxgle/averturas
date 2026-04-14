import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight, BarChart3, PieChart, LineChart } from 'lucide-react';

export function Reportes() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <TrendingUp size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500">Análisis y estadísticas del negocio</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card py-14 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
          <TrendingUp size={30} className="text-purple-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-700 mb-1">Módulo en desarrollo</h2>
        <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
          Próximamente vas a poder analizar ventas, márgenes, rendimiento por producto y más.
        </p>
        <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><BarChart3 size={14} className="text-purple-400" /> Ventas</span>
          <span className="flex items-center gap-1.5"><LineChart size={14} className="text-violet-400" /> Tendencias</span>
          <span className="flex items-center gap-1.5"><PieChart size={14} className="text-fuchsia-400" /> Márgenes</span>
        </div>
        <Link to="/operaciones" className="inline-flex items-center gap-1.5 mt-6 text-sm text-purple-600 hover:text-purple-700 font-medium">
          Ver operaciones <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
