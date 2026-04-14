import { Package } from 'lucide-react';

export function Stock() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Stock</h1>
      <p className="text-sm text-gray-500 mb-8">Gestión de inventario</p>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-20 text-center">
        <Package size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Módulo en desarrollo</p>
        <p className="text-xs text-gray-400 mt-1">Próximamente podrás gestionar tu inventario desde aquí</p>
      </div>
    </div>
  );
}
