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
}

interface ReciboData {
  id: string; numero: string; fecha: string; estado: string;
  forma_pago: string; referencia_pago: string | null;
  concepto: string | null; notas: string | null; monto_total: number;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  operacion: { id: string; numero: string; precio_total: number } | null;
  remito: { id: string; numero: string } | null;
  items: {
    id: string; descripcion: string; cantidad: number; monto: number;
    producto_nombre: string | null;
  }[];
  created_by_nombre: string | null;
  cobrado_operacion: number;
  compromiso: { monto: number; fecha_vencimiento: string; tipo: string } | null;
}

const PAGO_LABEL: Record<string, string> = {
  efectivo:        'Efectivo',
  transferencia:   'Transferencia bancaria',
  cheque:          'Cheque',
  tarjeta_debito:  'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  mercadopago:     'MercadoPago',
  otro:            'Otro',
};

export function ImprimirRecibo() {
  const { id } = useParams<{ id: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [recibo,  setRecibo]  = useState<ReciboData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Empresa>('/empresa'),
      api.get<ReciboData>(`/recibos/${id}`),
    ]).then(([e, r]) => { setEmpresa(e); setRecibo(r); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">Cargando...</div>
  );
  if (!recibo) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">No encontrado</div>
  );

  const cl = recibo.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';

  const tieneItems = recibo.items && recibo.items.length > 0;

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
        <span className="text-sm font-semibold text-gray-700">Recibo {recibo.numero}</span>
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
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 p-10 shadow-lg" style={{ minHeight: '200mm' }}>

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
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: RED, fontSize: 26, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              Recibo
            </div>
            <div style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginTop: 4 }}>{recibo.numero}</div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>Fecha: {fmtFecha(recibo.fecha)}</div>
            {recibo.operacion && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                Ref. presupuesto: <strong>{recibo.operacion.numero}</strong>
              </div>
            )}
            {recibo.remito && (
              <div style={{ fontSize: 11, color: '#555' }}>
                Ref. remito: <strong>{recibo.remito.numero}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: NAVY, height: 2, marginBottom: 20 }} />

        {/* Cliente */}
        <div style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: '10px 14px', marginBottom: 20, borderLeft: `4px solid ${NAVY}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
            Recibimos de
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{clienteNombre}</span>
            {cl.documento_nro && (
              <span style={{ fontSize: 11, color: '#555' }}>
                {cl.tipo_persona === 'juridica' ? 'CUIT' : 'DNI'}: {cl.documento_nro}
              </span>
            )}
          </div>
          {(cl.telefono || cl.email) && (
            <div style={{ display: 'flex', gap: 18, fontSize: 11, color: '#555', marginTop: 2 }}>
              {cl.telefono && <span>Tel: {cl.telefono}</span>}
              {cl.email    && <span>{cl.email}</span>}
            </div>
          )}
          {(cl.direccion || cl.localidad) && (
            <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
              {[cl.direccion, cl.localidad].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Monto grande */}
        <div style={{
          border: `2px solid ${NAVY}`, borderRadius: 10, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div>
            <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Importe total
            </div>
            <div style={{ color: NAVY, fontSize: 28, fontWeight: 900, fontFamily: 'monospace', marginTop: 2 }}>
              {fmt(Number(recibo.monto_total))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Forma de pago
            </div>
            <div style={{ color: NAVY, fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {PAGO_LABEL[recibo.forma_pago] ?? recibo.forma_pago}
            </div>
            {recibo.referencia_pago && (
              <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                Ref: {recibo.referencia_pago}
              </div>
            )}
          </div>
        </div>

        {/* Concepto */}
        {recibo.concepto && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
              Concepto
            </div>
            <div style={{ fontSize: 13, color: '#333' }}>{recibo.concepto}</div>
          </div>
        )}

        {/* Detalle de ítems si tiene */}
        {tieneItems && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ textAlign: 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#555' }}>Descripción</th>
                <th style={{ textAlign: 'right', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#555' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {recibo.items.map((item, i) => (
                <tr key={item.id ?? i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8f9fa' }}>
                  <td style={{ padding: '7px 10px', fontSize: 13, color: '#333', borderBottom: '1px solid #eee' }}>
                    {item.descripcion}
                  </td>
                  <td style={{ padding: '7px 10px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace', borderBottom: '1px solid #eee' }}>
                    {fmt(Number(item.monto))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Operacion vinculada + saldo */}
        {recibo.operacion && (
          <div style={{ paddingTop: 10, borderTop: '1px solid #eee', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 2 }}>
                  Total de la operación
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                  {fmt(Number(recibo.operacion.precio_total))}
                </div>
              </div>
              {(() => {
                const saldo = Math.max(0, Number(recibo.operacion.precio_total) - Number(recibo.cobrado_operacion ?? 0));
                if (saldo < 0.01) return null;
                return (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 2 }}>
                      Saldo pendiente
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>
                      {fmt(saldo)}
                      {recibo.compromiso?.fecha_vencimiento && (
                        <span style={{ fontWeight: 400, fontSize: 11, color: '#555', marginLeft: 8 }}>
                          a cancelar el{' '}
                          {new Date(recibo.compromiso.fecha_vencimiento + 'T12:00:00')
                            .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {recibo.notas && (
          <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 3 }}>
              Notas
            </div>
            <div style={{ fontSize: 12, color: '#444' }}>{recibo.notas}</div>
          </div>
        )}

        {/* Firma */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginTop: 52 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: 52 }} />
            <div style={{ borderTop: '1px solid #999', paddingTop: 10, fontSize: 11, color: '#555' }}>
              Firma — {empresa?.nombre ?? 'Empresa'}
              {recibo.created_by_nombre ? ` (${recibo.created_by_nombre})` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: 52 }} />
            <div style={{ borderTop: '1px solid #999', paddingTop: 10, fontSize: 11, color: '#555' }}>
              Firma y aclaración — Cliente
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
