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
  total_descuentos_operacion: number;
  compromiso: { monto: number; fecha_vencimiento: string; tipo: string } | null;
  descuento_pct:    number;
  monto_lista:      number;
  monto_descuento:  number;
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
    ]).then(([e, r]) => { setEmpresa(e); setRecibo(r); setLoading(false); })
      .catch(() => setLoading(false));
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
          @page { size: A4 portrait; margin: 8mm 12mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .doc { margin: 0 !important; min-height: auto !important; box-shadow: none !important; }
        }
        * { box-sizing: border-box; }
        body { font-family: Arial, 'Helvetica Neue', sans-serif; margin: 0; background: #d1d9e6; }
        .doc { background: white; }
        .doc-title { font-family: Georgia, 'Times New Roman', serif; }
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
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 shadow-xl" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>

        {/* ── HEADER unificado ──────────────────────────────────────────── */}
        <div style={{ padding: '22px 28px 18px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>

            {/* Izquierda: logo + contacto */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <img src="/logo2.png" alt="Logo" style={{ height: 88, display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div style={{ height: 1, background: '#e5e7eb', marginBottom: 8 }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 0', fontSize: 10.5, color: '#555', marginBottom: 4 }}>
                {empresa?.cuit && (
                  <><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>🪪 CUIT: {empresa.cuit}</span>
                  {(empresa?.telefono || empresa?.email) && <span style={{ color: '#ccc', margin: '0 10px' }}>|</span>}</>
                )}
                {empresa?.telefono && (
                  <><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>📞 {empresa.telefono}</span>
                  {empresa?.email && <span style={{ color: '#ccc', margin: '0 10px' }}>|</span>}</>
                )}
                {empresa?.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>✉️ {empresa.email}</span>}
              </div>
              {empresa?.direccion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: '#555' }}>
                  📍 {empresa.direccion}
                </div>
              )}
            </div>

            {/* Separador vertical */}
            <div style={{ width: 1, background: '#d1d5db', alignSelf: 'stretch', margin: '4px 0' }} />

            {/* Derecha: RECIBO */}
            <div style={{ textAlign: 'right', minWidth: 170 }}>
              <div className="doc-title"
                style={{ color: RED, fontSize: 40, fontWeight: 900, letterSpacing: 3, lineHeight: 1, textTransform: 'uppercase' }}>
                Recibo
              </div>
              <div className="doc-title"
                style={{ color: NAVY, fontWeight: 800, fontSize: 16, marginTop: 8 }}>
                {recibo.numero}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                📅 <span><strong style={{ color: NAVY }}>Fecha:</strong> {fmtFecha(recibo.fecha)}</span>
              </div>
              {recibo.operacion && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                  🔗 Ref. presupuesto: <strong style={{ color: NAVY }}>{recibo.operacion.numero}</strong>
                </div>
              )}
              {recibo.remito && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                  📦 Ref. remito: <strong style={{ color: NAVY }}>{recibo.remito.numero}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Separador doble navy */}
        <div style={{ height: 4, background: NAVY }} />
        <div style={{ height: 1, background: '#3a5fad', marginBottom: 0 }} />

        {/* padding del cuerpo */}
        <div style={{ padding: '20px 28px', flex: 1 }}>

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

        {/* Descuento aplicado */}
        {Number(recibo.monto_descuento) > 0 && (
          <div style={{ backgroundColor: '#f5f0ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>
                Bonificación {Number(recibo.descuento_pct) % 1 === 0 ? Number(recibo.descuento_pct).toFixed(0) : Number(recibo.descuento_pct).toFixed(1)}% aplicada
              </span>
              <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>
                Ahorro: {fmt(Number(recibo.monto_descuento))}
              </span>
            </div>
            {recibo.operacion && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                <span>Total de la operación sin descuento</span>
                <span>{fmt(Number(recibo.operacion.precio_total))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' }}>
              <span>Sin bonificación pagaría</span>
              <span style={{ textDecoration: 'line-through', color: '#999' }}>{fmt(Number(recibo.monto_lista))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginTop: 2 }}>
              <span>Con bonificación paga</span>
              <span style={{ fontWeight: 600, color: '#7c3aed' }}>{fmt(Number(recibo.monto_total))}</span>
            </div>
          </div>
        )}

        {/* Operacion vinculada + saldo */}
        {recibo.operacion && (
          <div style={{ paddingTop: 10, borderTop: '1px solid #eee', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              {/* "Total de la operación" ya se muestra dentro del recuadro lila si hay descuento */}
              {!Number(recibo.monto_descuento) && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 2 }}>
                    Total de la operación
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                    {fmt(Number(recibo.operacion.precio_total))}
                  </div>
                </div>
              )}
              {(() => {
                // saldo real = precio_total - cobrado - descuentos otorgados (no son deuda)
                const saldo = Math.max(
                  0,
                  Number(recibo.operacion.precio_total)
                  - Number(recibo.cobrado_operacion ?? 0)
                  - Number(recibo.total_descuentos_operacion ?? 0)
                );
                if (saldo < 0.01) return null;
                const fvRaw = recibo.compromiso?.fecha_vencimiento;
                const fvStr = fvRaw
                  ? new Date(fvRaw.slice(0, 10) + 'T12:00:00')
                      .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : null;
                return (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 2 }}>
                      Saldo pendiente
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: RED }}>
                      {fmt(saldo)}
                      {fvStr && (
                        <span style={{ fontWeight: 400, fontSize: 11, color: '#555', marginLeft: 8 }}>
                          a cancelar el {fvStr}
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

        </div>{/* fin padding cuerpo */}

        {/* FOOTER unificado */}
        <div style={{
          marginTop: 'auto', background: NAVY,
          padding: '10px 24px',
          display: 'flex', justifyContent: 'center',
          flexWrap: 'wrap' as const, gap: '0 28px',
          fontSize: 10, color: '#bfdbfe',
        }}>
          {empresa?.telefono  && <span>📞 {empresa.telefono}</span>}
          {empresa?.email     && <span>✉ {empresa.email}</span>}
          {empresa?.direccion && <span>📍 {empresa.direccion}</span>}
        </div>
      </div>
    </>
  );
}
