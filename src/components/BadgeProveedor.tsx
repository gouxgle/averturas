import { Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colorProveedor, type ProveedorConColor } from '@/lib/coloresProveedor';

interface BadgeProveedorProps {
  proveedor?: (ProveedorConColor & { nombre?: string | null }) | null;
  /** 'xs' para filas/dropdowns apretados, 'sm' para tarjetas. */
  size?: 'xs' | 'sm';
  className?: string;
}

// Etiqueta con el color identificatorio del proveedor. Se usa en catálogo, venta
// rápida, stock y los buscadores de producto — un solo componente para que no se
// desalineen entre pantallas.
export function BadgeProveedor({ proveedor, size = 'sm', className }: BadgeProveedorProps) {
  const color = colorProveedor(proveedor);
  if (!color || !proveedor?.nombre) return null;

  return (
    <span
      title={`Proveedor: ${proveedor.nombre}`}
      className={cn(
        'inline-flex items-center gap-1 rounded border font-medium leading-none max-w-full',
        size === 'xs' ? 'text-[9px] px-1 py-0.5' : 'text-[9px] px-1.5 py-0.5',
        color.badge,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
      <span className="truncate">{proveedor.nombre}</span>
    </span>
  );
}

// Franja sólida con el nombre del proveedor, para la cabecera de la tarjeta del
// catálogo y del modal de detalle. Es la versión "de un vistazo": el color ocupa
// todo el ancho, así se distingue en una grilla sin tener que leer nada.
// Si el proveedor no trae nombre, degrada a una franja de color a secas.
export function BandaProveedor({
  proveedor, plazoDias, className,
}: {
  proveedor?: (ProveedorConColor & { nombre?: string | null }) | null;
  /**
   * Plazo DECLARADO por el proveedor, en días. Se muestra pegado al nombre porque
   * quién entrega y en cuánto es una sola decisión al armar un presupuesto.
   * Si es null la franja se dibuja igual que sin la prop.
   */
  plazoDias?: number | null;
  className?: string;
}) {
  const color = colorProveedor(proveedor);
  if (!color) return null;

  if (!proveedor?.nombre) {
    return <div className={cn('h-2 w-full shrink-0', className)} style={{ backgroundColor: color.hex }} />;
  }

  const title = plazoDias != null
    ? `Proveedor: ${proveedor.nombre} — plazo declarado ≈${plazoDias} días (estimado general del proveedor, no confirmado para este producto)`
    : `Proveedor: ${proveedor.nombre}`;

  return (
    <div title={title} className={cn('flex items-center gap-1.5 px-2.5 py-1 shrink-0', color.solid, className)}>
      <Factory size={11} className="shrink-0 opacity-90" />
      <span className="text-[10px] font-bold uppercase tracking-wide truncate">{proveedor.nombre}</span>
      {plazoDias != null && (
        <span className="ml-auto text-[10px] font-bold tabular-nums shrink-0 opacity-90">≈{plazoDias}d</span>
      )}
    </div>
  );
}
