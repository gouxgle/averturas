import { Settings } from 'lucide-react';

export function Configuracion() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-1">Configuración</h1>
      <p className="text-sm text-gray-500 mb-8">Ajustes del sistema</p>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-20 text-center">
        <Settings size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Módulo en desarrollo</p>
        <p className="text-xs text-gray-400 mt-1">Aquí podrás configurar empresa, usuarios, proveedores y más</p>
      </div>
    </div>
  );
}
