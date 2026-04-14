import { SlidersHorizontal, Users, Building2, Truck, Palette } from 'lucide-react';

const MODULOS = [
  { icon: Building2, label: 'Empresa', desc: 'Datos del negocio, logo, CUIT', color: 'text-slate-600', bg: 'bg-slate-100' },
  { icon: Users,     label: 'Usuarios', desc: 'Accesos y permisos del equipo', color: 'text-blue-600', bg: 'bg-blue-100' },
  { icon: Truck,     label: 'Proveedores', desc: 'Gestión de proveedores', color: 'text-amber-600', bg: 'bg-amber-100' },
  { icon: Palette,   label: 'Categorías', desc: 'Tipos y categorías de productos', color: 'text-purple-600', bg: 'bg-purple-100' },
];

export function Configuracion() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
          <SlidersHorizontal size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500">Ajustes del sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {MODULOS.map(({ icon: Icon, label, desc, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 opacity-60 cursor-not-allowed">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-sm font-semibold text-gray-700">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            <span className="inline-block mt-3 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Próximamente
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
