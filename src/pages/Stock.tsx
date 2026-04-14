import { Link } from 'react-router-dom';
import { Boxes, Plus, ArrowRight } from 'lucide-react';

export function Stock() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Boxes size={20} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock</h1>
          <p className="text-sm text-gray-500">Gestión de inventario</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
          <Boxes size={30} className="text-orange-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-700 mb-1">Módulo en desarrollo</h2>
        <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
          Próximamente podrás controlar el inventario de materiales, herrajes y perfiles.
        </p>
        <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Materiales</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Herrajes</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Perfiles</span>
        </div>
        <Link to="/productos" className="inline-flex items-center gap-1.5 mt-6 text-sm text-orange-600 hover:text-orange-700 font-medium">
          Ver catálogo de productos <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
