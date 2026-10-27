import { NavLink } from 'react-router-dom';
import { HeartHandshake, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

// Las dos partes de Post venta: el seguimiento de satisfacción y las garantías / servicios técnicos.
export function VistasPostventa() {
  const cls = ({ isActive }: { isActive: boolean }) => cn(
    'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 rounded-xl text-sm font-bold border transition-colors',
    isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500');
  return (
    <nav className="flex gap-2" aria-label="Secciones de post venta">
      <NavLink to="/postventa" end className={cls}><HeartHandshake size={16} /> Seguimientos</NavLink>
      <NavLink to="/postventa/servicios" className={cls} data-testid="vista-servicios"><Wrench size={16} /> Garantías y servicios</NavLink>
    </nav>
  );
}
