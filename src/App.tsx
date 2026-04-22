import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/Layout/AppLayout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Operaciones } from '@/pages/Operaciones';
import { NuevaOperacion } from '@/pages/NuevaOperacion';
import { OperacionDetalle } from '@/pages/OperacionDetalle';
import { Clientes } from '@/pages/Clientes';
import { NuevoCliente } from '@/pages/NuevoCliente';
import { ClienteDetalle } from '@/pages/ClienteDetalle';
import { Stock } from '@/pages/Stock';
import { Reportes } from '@/pages/Reportes';
import { Configuracion } from '@/pages/Configuracion';
import { Productos } from '@/pages/Productos';
import { NuevoProducto } from '@/pages/NuevoProducto';
import { Presupuestos } from '@/pages/Presupuestos';
import { NuevoPresupuesto } from '@/pages/NuevoPresupuesto';
import { Proveedores } from '@/pages/Proveedores';
import { Remitos } from '@/pages/Remitos';
import { NuevoRemito } from '@/pages/NuevoRemito';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/operaciones" element={<Operaciones />} />
                <Route path="/operaciones/nueva" element={<NuevaOperacion />} />
                <Route path="/operaciones/:id" element={<OperacionDetalle />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/nuevo" element={<NuevoCliente />} />
                <Route path="/clientes/:id/editar" element={<NuevoCliente />} />
                <Route path="/clientes/:id" element={<ClienteDetalle />} />
                <Route path="/presupuestos" element={<Presupuestos />} />
                <Route path="/presupuestos/nuevo" element={<NuevoPresupuesto />} />
                <Route path="/productos" element={<Productos />} />
                <Route path="/productos/nuevo" element={<NuevoProducto />} />
                <Route path="/productos/:id" element={<NuevoProducto />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/remitos" element={<Remitos />} />
                <Route path="/remitos/nuevo" element={<NuevoRemito />} />
                <Route path="/remitos/:id/editar" element={<NuevoRemito />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/configuracion" element={<Configuracion />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
