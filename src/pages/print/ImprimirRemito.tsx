import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Printer, X } from 'lucide-react';

const NAVY = '#031d49';
const RED  = '#e31e24';

const fmt = (n: number) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null; logo_url: string | null;
  instagram: string | null;
}

interface RemitoData {
  id: string; numero: string; estado: string;
  medio_envio: string; transportista: string | null;
  nro_seguimiento: string | null; direccion_entrega: string | null;
  fecha_emision: string; fecha_entrega_est: string | null;
  notas: string | null;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; direccion: string | null;
  };
  operacion: { id: string; numero: string; tipo: string } | null;
  items: {
    id: string; descripcion: string; cantidad: number;
    precio_unitario: string | number; estado_producto: string; notas_item: string | null;
    producto: { nombre: string; codigo: string | null } | null;
  }[];
}

const MEDIO_LABEL: Record<string, string> = {
  retiro_local:     'Retiro en local',
  encomienda:       'Encomienda',
  flete_propio:     'Flete propio',
  flete_tercero:    'Flete tercerizado',
  correo_argentino: 'Correo Argentino',
  otro:             'Otro',
};

const ESTADO_PROD_LABEL: Record<string, string> = {
  nuevo:        'Nuevo',
  bueno:        'Bueno',
  con_detalles: 'Con detalles',
};

export function ImprimirRemito() {
  const { id } = useParams<{ id: string }>();
  const [empresa,  setEmpresa]  = useState<Empresa | null>(null);
  const [remito,   setRemito]   = useState<RemitoData | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Empresa>('/empresa'),
      api.get<RemitoData>(`/remitos/${id}`),
    ]).then(([e, r]) => { setEmpresa(e); setRemito(r); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">Cargando...</div>
  );
  if (!remito) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">No encontrado</div>
  );

  const cl = remito.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';

  const totalEstimado = remito.items.reduce((s, it) => {
    const p = parseFloat(String(it.precio_unitario)) || 0;
    return s + p * it.cantidad;
  }, 0);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 18mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f5f5f5; }
        .doc { background: white; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <span className="text-sm font-semibold text-gray-700">Remito {remito.numero}</span>
        <div className="flex gap-2">
          <button onClick={() => window.close()}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <X size={14} /> Cerrar
          </button>
          <button onClick={() => window.print()}
            style={{ backgroundColor: NAVY }}
            className="flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90">
            <Printer size={14} /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 p-10 shadow-lg" style={{ minHeight: '297mm' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <img src="/logochico.png" alt="Logo" style={{ height: 34 }} />
              <div style={{ color: NAVY, fontSize: 15, fontWeight: 900 }}>{empresa?.nombre ?? ''}</div>
            </div>
            {empresa?.cuit     && <div style={{ color: '#555', fontSize: 11 }}>CUIT: {empresa.cuit}</div>}
            {empresa?.telefono && <div style={{ color: '#555', fontSize: 11 }}>Tel: {empresa.telefono}</div>}
            {empresa?.email    && <div style={{ color: '#555', fontSize: 11 }}>{empresa.email}</div>}
            {empresa?.direccion && <div style={{ color: '#555', fontSize: 11 }}>{empresa.direccion}</div>}
            {(empresa as any)?.instagram && <div style={{ color: '#555', fontSize: 11 }}>Instagram: {(empresa as any).instagram}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: RED, fontSize: 26, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              Remito
            </div>
            <div style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginTop: 4 }}>{remito.numero}</div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>Emisión: {fmtFecha(remito.fecha_emision)}</div>
            {remito.fecha_entrega_est && (
              <div style={{ color: '#666', fontSize: 11 }}>Entrega estimada: {fmtFecha(remito.fecha_entrega_est)}</div>
            )}
            {remito.operacion && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                Ref. presupuesto: <strong>{remito.operacion.numero}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: NAVY, height: 2, marginBottom: 18 }} />

        {/* Cliente + Logística */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: '10px 14px', borderLeft: `4px solid ${NAVY}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
              Destinatario
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{clienteNombre}</div>
            {cl.telefono && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Tel: {cl.telefono}</div>}
            {cl.direccion && <div style={{ fontSize: 11, color: '#555' }}>{cl.direccion}</div>}
          </div>

          <div style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: '10px 14px', borderLeft: `4px solid ${RED}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
              Logística
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              {MEDIO_LABEL[remito.medio_envio] ?? remito.medio_envio}
            </div>
            {remito.transportista && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Transportista: {remito.transportista}</div>
            )}
            {remito.nro_seguimiento && (
              <div style={{ fontSize: 11, color: '#555' }}>Seguimiento: {remito.nro_seguimiento}</div>
            )}
            {remito.direccion_entrega && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Entrega en: {remito.direccion_entrega}</div>
            )}
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ backgroundColor: NAVY, color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Descripción</th>
              <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Cant.</th>
              <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Estado</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Precio</th>
              <th style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, width: 24 }}></th>
            </tr>
          </thead>
          <tbody>
            {remito.items.map((item, i) => (
              <tr key={item.id ?? i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                <td style={{ padding: '8px 10px', fontSize: 12, color: '#888', borderBottom: '1px solid #eee' }}>{i + 1}</td>
                <td style={{ padding: '8px 10px', fontSize: 13, color: '#1a1a1a', borderBottom: '1px solid #eee' }}>
                  <div>{item.descripcion}</div>
                  {item.notas_item && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{item.notas_item}</div>}
                </td>
                <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'center', borderBottom: '1px solid #eee' }}>{item.cantidad}</td>
                <td style={{ padding: '8px 10px', fontSize: 11, textAlign: 'center', borderBottom: '1px solid #eee', color: '#555' }}>
                  {ESTADO_PROD_LABEL[item.estado_producto] ?? item.estado_producto}
                </td>
                <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee', color: '#555' }}>
                  {parseFloat(String(item.precio_unitario)) > 0 ? fmt(parseFloat(String(item.precio_unitario))) : '—'}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }} />
              </tr>
            ))}
          </tbody>
          {totalEstimado > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} />
                <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, textAlign: 'right', borderTop: `2px solid ${NAVY}`, color: '#333' }}>
                  Total estimado
                </td>
                <td style={{ padding: '8px 10px', borderTop: `2px solid ${NAVY}` }} />
              </tr>
              <tr>
                <td colSpan={4} />
                <td style={{ padding: '4px 10px', fontSize: 16, fontWeight: 900, textAlign: 'right', fontFamily: 'monospace', color: NAVY }}>
                  {fmt(totalEstimado)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {remito.notas && (
          <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '10px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
              Observaciones
            </div>
            <div style={{ fontSize: 12, color: '#444', whiteSpace: 'pre-wrap' }}>{remito.notas}</div>
          </div>
        )}

        {/* Firma */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 8, fontSize: 11, color: '#666' }}>
              Entregó — Firma y aclaración
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 8, fontSize: 11, color: '#666' }}>
              Recibió conforme — Firma y aclaración
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `2px solid ${RED}`, marginTop: 28, paddingTop: 12, textAlign: 'center', fontSize: 10, color: '#999' }}>
          {[empresa?.nombre, empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.telefono ? `Tel: ${empresa.telefono}` : null, empresa?.email, empresa?.direccion].filter(Boolean).join(' · ')}
        </div>
      </div>
    </>
  );
}
