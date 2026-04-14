import { BarChart3 } from 'lucide-react';

export function Reportes() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Reportes</h1>
      <p className="text-sm text-gray-500 mb-8">Análisis y estadísticas</p>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-20 text-center">
        <BarChart3 size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Módulo en desarrollo</p>
        <p className="text-xs text-gray-400 mt-1">Próximamente podrás ver reportes de ventas, márgenes y más</p>
      </div>
    </div>
  );
}
