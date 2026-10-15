import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const NAVY = '#031d49';

interface Empresa { nombre: string; cuit: string | null; telefono: string | null; email: string | null; direccion: string | null; logo_url: string | null }
interface Item { id: string; descripcion: string; cantidad: number; destino: 'stock' | 'no_reingresa'; motivo_item: string | null; precio_unitario_neto: number; estado_producto: string }
interface Dev {
  numero: string; fecha: string; estado: string; motivo: string; cliente_nombre: string | null; cliente_telefono: string | null;
  operacion_numero: string | null; remito_numero: string | null; valor_total: number; aplicado_a_saldo: number;
  credito_monto: number; reintegro_monto: number; anulada_motivo: string | null; creado_por: string | null; items: Item[];
}

const fmtFecha = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Comprobante de devolución (navegador: window.print()). Sin facturación: es un comprobante interno,
// no reemplaza la nota de crédito fiscal.
export function ImprimirDevolucion() {
  const { id } = useParams<{ id: string }>();
  const [dev, setDev] = useState<Dev | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get<Dev>(`/devoluciones/${id}`), api.get<Empresa>('/empresa')])
      .then(([d, e]) => { setDev(d); setEmpresa(e); })
      .catch(() => setError(true));
  }, [id]);

  if (error) return <div style={{ padding: 40, fontFamily: 'Arial', color: '#888' }}>No encontrada</div>;
  if (!dev || !empresa) return <div style={{ padding: 40, fontFamily: 'Arial', color: '#888' }}>Cargando...</div>;

  const n = (x: unknown) => Number(x ?? 0);
  return (
    <>
      <style>{`
        @media print { @page { size: A4 portrait; margin: 10mm 12mm; } .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .doc { margin: 0 !important; box-shadow: none !important; } }
        * { box-sizing: border-box; } body { font-family: Arial, 'Helvetica Neue', sans-serif; margin: 0; background: #d1d9e6; }
        table { border-collapse: collapse; width: 100%; }
      `}</style>
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Devolución {dev.numero}</span>
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
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 800, color: NAVY }}>DEVOLUCIÓN</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>N° {dev.numero}</div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>Fecha: {fmtFecha(dev.fecha)}</div>
            {dev.estado === 'anulada' && <div style={{ color: '#b91c1c', fontWeight: 800, fontSize: 12 }}>ANULADA</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, margin: '14px 0', fontSize: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: NAVY, textTransform: 'uppercase' }}>Cliente</div>
            <div style={{ fontWeight: 700 }}>{dev.cliente_nombre}</div>
            {dev.cliente_telefono && <div style={{ color: '#4b5563' }}>{dev.cliente_telefono}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: NAVY, textTransform: 'uppercase' }}>Referencia</div>
            {dev.remito_numero && <div>Remito {dev.remito_numero}</div>}
            {dev.operacion_numero && <div>Presupuesto {dev.operacion_numero.replace(/^OP-/, 'PRO-')}</div>}
          </div>
        </div>

        <table style={{ fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: NAVY, color: '#fff', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <th style={{ textAlign: 'left', padding: '6px 8px' }}>Producto</th>
              <th style={{ padding: '6px 8px', width: 50 }}>Cant.</th>
              <th style={{ padding: '6px 8px', width: 130 }}>Destino</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', width: 100 }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {dev.items.map(it => (
              <tr key={it.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 8px' }}>{it.descripcion}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700 }}>{it.cantidad}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontSize: 10.5 }}>
                  {it.destino === 'stock' ? `Vuelve a stock (${it.estado_producto.replace('_', ' ')})` : `No reingresa: ${it.motivo_item ?? ''}`}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>{formatCurrency(n(it.precio_unitario_neto) * it.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <table style={{ width: 280, fontSize: 12 }}>
            <tbody>
              <tr><td style={{ padding: '4px 8px' }}>Valor devuelto</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(n(dev.valor_total))}</td></tr>
              {n(dev.aplicado_a_saldo) > 0 && <tr><td style={{ padding: '4px 8px' }}>Aplicado a la deuda</td><td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(n(dev.aplicado_a_saldo))}</td></tr>}
              {n(dev.reintegro_monto) > 0 && <tr><td style={{ padding: '4px 8px' }}>Reintegrado en dinero</td><td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(n(dev.reintegro_monto))}</td></tr>}
              {n(dev.credito_monto) > 0 && <tr><td style={{ padding: '4px 8px' }}>Saldo a favor del cliente</td><td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(n(dev.credito_monto))}</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, fontSize: 11.5 }}><b>Motivo:</b> {dev.motivo}</div>
        {dev.anulada_motivo && <div style={{ marginTop: 6, fontSize: 11.5, color: '#b91c1c' }}><b>Anulada:</b> {dev.anulada_motivo}</div>}

        <div style={{ display: 'flex', gap: 40, marginTop: 70 }}>
          {['Firma del cliente', 'Recibió por la empresa'].map(t => (
            <div key={t} style={{ flex: 1, textAlign: 'center', borderTop: '1px solid #6b7280', paddingTop: 4, fontSize: 10.5, color: '#374151' }}>{t}</div>
          ))}
        </div>
        <div style={{ marginTop: 22, fontSize: 9.5, color: '#6b7280', textAlign: 'center' }}>
          Comprobante interno de devolución. No reemplaza a la nota de crédito fiscal.
        </div>
      </div>
    </>
  );
}
