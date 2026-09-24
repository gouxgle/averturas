import { FileText, MapPin, Zap, ShoppingCart, type LucideIcon } from 'lucide-react';
import type { SeccionManual } from './tipos';
import { MANUAL_PRESUPUESTOS } from './manualPresupuestos';
import { MANUAL_VISITAS } from './manualVisitas';
import { MANUAL_VENTA_RAPIDA } from './manualVentaRapida';
import { MANUAL_COMPRAS } from './manualCompras';

export interface Manual {
  /** Va en la URL: `/ayuda/:slug` y `/imprimir/manual/:slug`. No cambiarlo sin migrar los links. */
  slug: string;
  titulo: string;
  sub: string;
  icono: LucideIcon;
  /** Clave de `SECTION_COLORS` (SectionHero.tsx) — tiñe el fondo y la franja. */
  seccion: string;
  /** Adónde lleva el botón "Ir a…" del encabezado. */
  ruta: string;
  rutaLabel: string;
  secciones: SeccionManual[];
}

/**
 * Los manuales del sistema, en orden de circuito comercial. El índice de `/ayuda` los
 * lista en este orden.
 */
export const MANUALES: Manual[] = [
  {
    slug: 'presupuestos',
    titulo: 'Presupuestos',
    sub: 'De la propuesta al cliente hasta el cobro',
    icono: FileText,
    seccion: 'presupuestos',
    ruta: '/presupuestos',
    rutaLabel: 'Ir a Presupuestos',
    secciones: MANUAL_PRESUPUESTOS,
  },
  {
    slug: 'visitas',
    titulo: 'Visitas de Relevamiento',
    sub: 'Medir en la obra y convertirlo en presupuesto',
    icono: MapPin,
    seccion: 'presupuestos',
    ruta: '/presupuestos/visitas-tecnicas',
    rutaLabel: 'Ir a Visitas',
    secciones: MANUAL_VISITAS,
  },
  {
    slug: 'venta-rapida',
    titulo: 'Venta rápida',
    sub: 'Vender en el mostrador en una sola pantalla',
    icono: Zap,
    seccion: 'recibos',
    ruta: '/ventas/rapida',
    rutaLabel: 'Ir a Venta rápida',
    secciones: MANUAL_VENTA_RAPIDA,
  },
  {
    slug: 'compras',
    titulo: 'Compras',
    sub: 'Cómo comprarle a un proveedor de punta a punta',
    icono: ShoppingCart,
    seccion: 'pedidos',
    ruta: '/compras',
    rutaLabel: 'Ir a Compras',
    secciones: MANUAL_COMPRAS,
  },
];

export function buscarManual(slug: string | undefined): Manual | undefined {
  return MANUALES.find(m => m.slug === slug);
}
