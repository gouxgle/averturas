import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '@/lib/api';

const NAVY = '#031d49';

interface Empresa { nombre: string; cuit: string | null; telefono: string | null; email: string | null; direccion: string | null; logo_url: string | null }
interface Reintegro {
  numero: string; fecha: string; monto: number; forma_pago: string; referencia: string | null; motivo: string | null;
  estado: 'emitido' | 'anulado'; motivo_anulacion: string | null; cliente_nombre: string | null; cliente_telefono: string | null;
  cliente_documento: string | null; devolucion_numero: string | null; creado_por: string | null;
}

const fmtFecha = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Comprobante de un reintegro (dinero que sale de caja hacia un cliente): el cliente firma que lo recibió.
// Es un comprobante interno, no una nota de crédito fiscal.
export function ImprimirReintegro() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Reintegro | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get<Reintegro>(`/reintegros/${id}`), api.get<Empresa>('/empresa')])
      .then(([x, e]) => { setR(x); setEmpresa(e); })
      .catch(() => setError(true));
  }, [id]);

  if (error) return <div style={{ padding: 40, fontFamily: 'Arial', color: '#888' }}>No encontrado</div>;
  if (!r || !empresa) return <div style={{ padding: 40, fontFamily: 'Arial', color: '#888' }}>Cargando...</div>;

  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 10mm 12mm; } .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .doc { margin: 0 !important; box-shadow: none !important; } }
        * { box-sizing: border-box; } body { font-family: Arial, 'Helvetica Neue', sans-serif; margin: 0; background: #d1d9e6; }
      `}</style>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Reintegro {r.numero}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.close()} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}><X size={13} /> Cerrar</button>
          <button onClick={() => window.print()} style={{ padding: '8px 14px', borderRadius: 8, background: NAVY, color: '#fff', fontSize: 13, border: 0, cursor: 'pointer' }}><Printer size={13} /> Imprimir / Guardar PDF</button>
        </div>
      </div>

      <div className="doc" style={{ background: '#fff', maxWidth: '210mm', margin: '64px auto 32px', padding: '14mm 14mm 10mm', boxShadow: '0 4px 24px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${NAVY}`, paddingBottom: 12 }}>
          <div>
            {empresa.logo_url && <img src={empresa.logo_url} alt="" style={{ height: 44, marginBottom: 6 }} />}
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{empresa.nombre}</div>
            <div style={{ fontSize: 10.5, color: '#4b5563', lineHeight: 1.5 }}>
              {[empresa.cuit && `CUIT ${empresa.cuit}`, empresa.telefono, empresa.email, empresa.direccion].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 800, color: NAVY }}>REINTEGRO</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>N° {r.numero}</div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>Fecha: {fmtFecha(r.fecha)}</div>
            {r.estado === 'anulado' && <div style={{ color: '#b91c1c', fontWeight: 800, fontSize: 12 }}>ANULADO</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, margin: '16px 0', fontSize: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: NAVY, textTransform: 'uppercase' }}>Cliente</div>
            <div style={{ fontWeight: 700 }}>{r.cliente_nombre}</div>
            {r.cliente_documento && <div style={{ color: '#4b5563' }}>Doc. {r.cliente_documento}</div>}
            {r.cliente_telefono && <div style={{ color: '#4b5563' }}>{r.cliente_telefono}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: NAVY, textTransform: 'uppercase' }}>Origen</div>
            <div>{r.devolucion_numero ? `Devolución ${r.devolucion_numero}` : 'Devolución de saldo a favor'}</div>
          </div>
        </div>

        <div style={{ border: `1px solid ${NAVY}`, borderRadius: 8, padding: '16px 18px', margin: '8px 0 14px' }}>
          <div style={{ fontSize: 11, color: '#4b5563' }}>Importe devuelto al cliente</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: NAVY }}>$ {Number(r.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            En <b>{r.forma_pago}</b>{r.referencia ? <> · Ref.: {r.referencia}</> : null}
          </div>
        </div>

        {r.motivo && <div style={{ fontSize: 11.5 }}><b>Concepto:</b> {r.motivo}</div>}
        {r.estado === 'anulado' && r.motivo_anulacion && <div style={{ marginTop: 6, fontSize: 11.5, color: '#b91c1c' }}><b>Anulado:</b> {r.motivo_anulacion}</div>}

        <div style={{ marginTop: 18, fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
          Recibí de <b>{empresa.nombre}</b> la suma indicada, en concepto de devolución, sin tener nada más que reclamar por este concepto.
        </div>

        <div style={{ display: 'flex', gap: 40, marginTop: 70 }}>
          {['Firma y aclaración del cliente', r.creado_por ? `Entregó: ${r.creado_por}` : 'Entregó'].map(t => (
            <div key={t} style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #6b7280', paddingTop: 4, fontSize: 10.5, color: '#374151' }}>{t}</div>
          ))}
        </div>
        <div style={{ marginTop: 22, fontSize: 9.5, color: '#6b7280', textAlign: 'center' }}>
          Comprobante interno de reintegro. No reemplaza a la nota de crédito fiscal.
        </div>
      </div>
    </>
  );
}
