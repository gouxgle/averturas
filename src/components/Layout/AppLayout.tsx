import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, LayoutGrid } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer en mobile, estático en desktop */}
      <div className={[
        'fixed inset-y-0 left-0 z-30 transition-transform duration-300',
        'lg:static lg:translate-x-0 lg:transition-none',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar solo en mobile */}
        <header className="lg:hidden h-14 bg-slate-900 flex items-center px-4 gap-3 shrink-0 shadow-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <LayoutGrid size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-wide">ABERTURAS</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
