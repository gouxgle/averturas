// Rutas principales del sistema — mismo listado que src/components/Layout/Sidebar.tsx.
// Se mantiene a mano (no se importa el Sidebar) para no arrastrar React/JSX al test runner.
// Si agregás un ítem al Sidebar, agregalo acá también.
export const MAIN_ROUTES: { label: string; path: string }[] = [
  { label: 'Dashboard',                          path: '/dashboard' },
  { label: 'CRM',                                path: '/crm' },
  { label: 'Venta rápida',                       path: '/ventas/rapida' },
  { label: 'Presupuestos',                       path: '/presupuestos' },
  { label: 'Visitas de Relevamiento de Datos',   path: '/presupuestos/visitas-tecnicas' },
  { label: 'Operaciones',                        path: '/operaciones' },
  { label: 'Remitos',                            path: '/remitos' },
  { label: 'Compras',                            path: '/compras' },
  { label: 'Agenda',                             path: '/agenda' },
  { label: 'Revisión de precios',                path: '/productos/precios' },
  { label: 'Revisión de precios: actualizar',    path: '/productos/precios?tab=actualizar' },
  { label: 'Revisión de precios: proveedor',     path: '/productos/precios?tab=proveedor' },
  { label: 'Agenda: internas',                   path: '/agenda?tab=internas' },
  { label: 'Facturación',                        path: '/facturacion' },
  { label: 'Facturación: por facturar',          path: '/facturacion?tab=por-facturar' },
  { label: 'Nueva factura',                      path: '/facturacion/nueva' },
  { label: 'Facturación: libro IVA',             path: '/facturacion?tab=libro-iva' },
  { label: 'Facturación: contingencia',          path: '/facturacion?tab=contingencia' },
  { label: 'Recibos',                            path: '/recibos' },
  { label: 'Clientes',                           path: '/clientes' },
  { label: 'Estado de Cuenta',                   path: '/estado-cuenta' },
  { label: 'Productos',                          path: '/productos' },
  { label: 'Existencias',                        path: '/stock' },
  { label: 'Proveedores',                        path: '/proveedores' },
  { label: 'Reportes',                           path: '/reportes' },
  { label: 'Novedades',                          path: '/novedades' },
  { label: 'Configuración',                      path: '/configuracion' },
];

export function slug(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '_') || 'root';
}
