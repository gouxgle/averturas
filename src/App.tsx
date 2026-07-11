import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/Layout/AppLayout';

const Login                    = lazy(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const Dashboard                = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Operaciones              = lazy(() => import('@/pages/Operaciones').then(m => ({ default: m.Operaciones })));
const NuevaOperacion           = lazy(() => import('@/pages/NuevaOperacion').then(m => ({ default: m.NuevaOperacion })));
const OperacionDetalle         = lazy(() => import('@/pages/OperacionDetalle').then(m => ({ default: m.OperacionDetalle })));
const Clientes                 = lazy(() => import('@/pages/Clientes').then(m => ({ default: m.Clientes })));
const NuevoCliente             = lazy(() => import('@/pages/NuevoCliente').then(m => ({ default: m.NuevoCliente })));
const ClienteDetalle           = lazy(() => import('@/pages/ClienteDetalle').then(m => ({ default: m.ClienteDetalle })));
const EstadoCuenta             = lazy(() => import('@/pages/EstadoCuenta').then(m => ({ default: m.EstadoCuenta })));
const Stock                    = lazy(() => import('@/pages/Stock').then(m => ({ default: m.Stock })));
const Reportes                 = lazy(() => import('@/pages/Reportes').then(m => ({ default: m.Reportes })));
const Configuracion            = lazy(() => import('@/pages/Configuracion').then(m => ({ default: m.Configuracion })));
const Productos                = lazy(() => import('@/pages/Productos').then(m => ({ default: m.Productos })));
const NuevoProducto            = lazy(() => import('@/pages/NuevoProducto').then(m => ({ default: m.NuevoProducto })));
const Presupuestos             = lazy(() => import('@/pages/Presupuestos').then(m => ({ default: m.Presupuestos })));
const NuevoPresupuesto         = lazy(() => import('@/pages/NuevoPresupuesto').then(m => ({ default: m.NuevoPresupuesto })));
const Proveedores              = lazy(() => import('@/pages/Proveedores').then(m => ({ default: m.Proveedores })));
const ProveedorPrecios         = lazy(() => import('@/pages/ProveedorPrecios').then(m => ({ default: m.ProveedorPrecios })));
const Remitos                  = lazy(() => import('@/pages/Remitos').then(m => ({ default: m.Remitos })));
const NuevoRemito              = lazy(() => import('@/pages/NuevoRemito').then(m => ({ default: m.NuevoRemito })));
const Recibos                  = lazy(() => import('@/pages/Recibos').then(m => ({ default: m.Recibos })));
const NuevoRecibo              = lazy(() => import('@/pages/NuevoRecibo').then(m => ({ default: m.NuevoRecibo })));
const Pedidos                  = lazy(() => import('@/pages/Pedidos'));
const NuevoPedido              = lazy(() => import('@/pages/NuevoPedido'));
const EstadoCuentaGlobal       = lazy(() => import('@/pages/EstadoCuentaGlobal').then(m => ({ default: m.EstadoCuentaGlobal })));
const CRM                      = lazy(() => import('@/pages/CRM').then(m => ({ default: m.CRM })));
const ImportarClientes         = lazy(() => import('@/pages/ImportarClientes').then(m => ({ default: m.ImportarClientes })));
const ImprimirPresupuesto      = lazy(() => import('@/pages/print/ImprimirPresupuesto').then(m => ({ default: m.ImprimirPresupuesto })));
const ImprimirRemito           = lazy(() => import('@/pages/print/ImprimirRemito').then(m => ({ default: m.ImprimirRemito })));
const ImprimirRecibo           = lazy(() => import('@/pages/print/ImprimirRecibo').then(m => ({ default: m.ImprimirRecibo })));
const FormularioCliente        = lazy(() => import('@/pages/print/FormularioCliente').then(m => ({ default: m.FormularioCliente })));
const VistaPublicaPresupuesto  = lazy(() => import('@/pages/VistaPublicaPresupuesto').then(m => ({ default: m.VistaPublicaPresupuesto })));
const VistaPublicaRemito       = lazy(() => import('@/pages/VistaPublicaRemito').then(m => ({ default: m.VistaPublicaRemito })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#f0f4fb' }}>
      <div className="w-8 h-8 border-3 border-gray-200 border-t-[#031d49] rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              {/* Rutas públicas — sin auth */}
              <Route path="/p/:token" element={<VistaPublicaPresupuesto />} />
              <Route path="/r/:token" element={<VistaPublicaRemito />} />
              <Route element={<ProtectedRoute />}>
                {/* Páginas de impresión — sin AppLayout */}
                <Route path="/imprimir/presupuesto/:id"  element={<ImprimirPresupuesto />} />
                <Route path="/imprimir/remito/:id"       element={<ImprimirRemito />} />
                <Route path="/imprimir/recibo/:id"       element={<ImprimirRecibo />} />
                <Route path="/imprimir/formulario-cliente" element={<FormularioCliente />} />
                <Route element={<AppLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/operaciones" element={<Operaciones />} />
                  <Route path="/operaciones/nueva" element={<NuevaOperacion />} />
                  <Route path="/operaciones/:id" element={<OperacionDetalle />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/clientes/importar" element={<ImportarClientes />} />
                  <Route path="/clientes/nuevo" element={<NuevoCliente />} />
                  <Route path="/clientes/:id/editar" element={<NuevoCliente />} />
                  <Route path="/clientes/:id/estado-cuenta" element={<EstadoCuenta />} />
                  <Route path="/clientes/:id" element={<ClienteDetalle />} />
                  <Route path="/crm" element={<CRM />} />
                  <Route path="/presupuestos" element={<Presupuestos />} />
                  <Route path="/presupuestos/nuevo" element={<NuevoPresupuesto />} />
                  <Route path="/presupuestos/:id/editar" element={<NuevoPresupuesto />} />
                  <Route path="/productos" element={<Productos />} />
                  <Route path="/productos/nuevo" element={<NuevoProducto />} />
                  <Route path="/productos/:id" element={<NuevoProducto />} />
                  <Route path="/stock" element={<Stock />} />
                  <Route path="/proveedores" element={<Proveedores />} />
                  <Route path="/proveedores/:id/precios" element={<ProveedorPrecios />} />
                  <Route path="/remitos" element={<Remitos />} />
                  <Route path="/remitos/nuevo" element={<NuevoRemito />} />
                  <Route path="/remitos/:id/editar" element={<NuevoRemito />} />
                  <Route path="/pedidos" element={<Pedidos />} />
                  <Route path="/pedidos/nuevo" element={<NuevoPedido />} />
                  <Route path="/pedidos/:id/editar" element={<NuevoPedido />} />
                  <Route path="/recibos" element={<Recibos />} />
                  <Route path="/recibos/nuevo" element={<NuevoRecibo />} />
                  <Route path="/recibos/:id/editar" element={<NuevoRecibo />} />
                  <Route path="/estado-cuenta" element={<EstadoCuentaGlobal />} />
                  <Route path="/reportes" element={<Reportes />} />
                  <Route path="/configuracion" element={<Configuracion />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
