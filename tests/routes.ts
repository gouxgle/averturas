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
  { label: 'Pedidos',                            path: '/pedidos' },
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
