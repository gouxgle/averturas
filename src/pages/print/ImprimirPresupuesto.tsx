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

interface Item {
  id: string; descripcion: string; cantidad: number;
  precio_unitario: number; precio_instalacion: number;
  incluye_instalacion: boolean; precio_total: number;
  medida_ancho: number | null; medida_alto: number | null;
  color: string | null; vidrio: string | null;
  accesorios: string[];
  tipo_abertura_nombre: string | null;
  sistema_nombre: string | null;
  notas: string | null;
}

interface Operacion {
  id: string; numero: string; tipo: string; estado: string;
  tipo_proyecto: string | null; forma_pago: string | null;
  tiempo_entrega: number | null; fecha_validez: string | null;
  notas: string | null; precio_total: number; created_at: string;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  items: Item[];
}

export function ImprimirPresupuesto() {
  const { id } = useParams<{ id: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [op, setOp]           = useState<Operacion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Empresa>('/empresa'),
      api.get<Operacion>(`/operaciones/${id}`),
    ]).then(([e, o]) => { setEmpresa(e); setOp(o); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">Cargando...</div>
  );
  if (!op) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">No encontrado</div>
  );

  const c = op.cliente;
  const clienteNombre = c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '—')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim() || '—';
  const clienteDoc = c.documento_nro
    ? (c.tipo_persona === 'juridica' ? `CUIT: ${c.documento_nro}` : `DNI: ${c.documento_nro}`)
    : null;
  const clienteDireccion = [c.direccion, c.localidad].filter(Boolean).join(', ') || null;

  const fechaEmision = fmtFecha(op.created_at);
  const fechaValidez = op.fecha_validez ? fmtFecha(op.fecha_validez + 'T12:00:00') : null;

  const proformaNumero = op.numero.replace(/^OP-/, 'PRO-');
  const total = op.items.reduce((s, it) => s + Number(it.precio_total), 0);
  const hayInstalacion = op.items.some(it => it.incluye_instalacion);

  // Logo: siempre /logochico.png como fuente primaria (igual que recibo)
  const logoSrc = '/logochico.png';

  // Instagram desde empresa si existe, fallback hardcoded
  const instagram = (empresa as any)?.instagram ?? '@cesarbritez.ok';

  const footerParts = [
    empresa?.nombre,
    empresa?.cuit ? `CUIT ${empresa.cuit}` : null,
    empresa?.telefono ? `Tel: ${empresa.telefono}` : null,
    empresa?.email,
    empresa?.direccion,
    instagram ? `Instagram: ${instagram}` : null,
  ].filter(Boolean).join(' · ');

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
        <span className="text-sm font-semibold text-gray-700">Proforma {proformaNumero}</span>
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

        {/* Header — mismo layout que recibo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <img src={logoSrc} alt="Logo" style={{ height: 34 }} />
              <div style={{ color: NAVY, fontSize: 15, fontWeight: 900 }}>{empresa?.nombre ?? ''}</div>
            </div>
            {empresa?.cuit      && <div style={{ color: '#555', fontSize: 11 }}>CUIT: {empresa.cuit}</div>}
            {empresa?.telefono  && <div style={{ color: '#555', fontSize: 11 }}>Tel: {empresa.telefono}</div>}
            {empresa?.email     && <div style={{ color: '#555', fontSize: 11 }}>{empresa.email}</div>}
            {empresa?.direccion && <div style={{ color: '#555', fontSize: 11 }}>{empresa.direccion}</div>}
            {instagram          && <div style={{ color: '#555', fontSize: 11 }}>Instagram: {instagram}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: RED, fontSize: 26, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              Proforma
            </div>
            <div style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginTop: 4 }}>
              N°: {proformaNumero}
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>Fecha: {fechaEmision}</div>
            {fechaValidez && (
              <div style={{ color: RED, fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                Válido hasta: {fechaValidez}
              </div>
            )}
            {op.tiempo_entrega && (
              <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                Entrega estimada: {op.tiempo_entrega} días
              </div>
            )}
          </div>
        </div>

        {/* Divider — mismo que recibo */}
        <div style={{ backgroundColor: NAVY, height: 2, marginBottom: 20 }} />

        {/* Cliente — mismo estilo que recibo */}
        <div style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: '10px 14px', marginBottom: 20, borderLeft: `4px solid ${NAVY}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
            Cliente
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{clienteNombre}</span>
            {clienteDoc && (
              <span style={{ fontSize: 11, color: '#555' }}>{clienteDoc}</span>
            )}
          </div>
          {(c.telefono || c.email) && (
            <div style={{ display: 'flex', gap: 18, fontSize: 11, color: '#555', marginTop: 2 }}>
              {c.telefono && <span>Tel: {c.telefono}</span>}
              {c.email    && <span>{c.email}</span>}
            </div>
          )}
          {clienteDireccion && (
            <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{clienteDireccion}</div>
          )}
        </div>

        {/* Detalle de ítems */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1.5, color: NAVY,
            borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, marginBottom: 10,
          }}>
            Detalle
          </div>

          {op.items.map((item, i) => {
            const precioUnitFinal = Number(item.precio_unitario) + (item.incluye_instalacion ? Number(item.precio_instalacion) : 0);
            const precioTotal = Number(item.precio_total);
            const titulo = item.tipo_abertura_nombre
              ? (item.descripcion && !item.descripcion.startsWith(item.tipo_abertura_nombre)
                  ? item.descripcion
                  : item.tipo_abertura_nombre)
              : item.descripcion;

            return (
              <div key={item.id} style={{
                marginBottom: 10, paddingBottom: 10,
                borderBottom: i < op.items.length - 1 ? '1px solid #e8e8e8' : 'none',
              }}>
                {/* Título del ítem */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                    {i + 1}. {titulo}
                  </span>
                  {item.cantidad > 1 && (
                    <span style={{ fontSize: 11, color: '#888' }}>x {item.cantidad}</span>
                  )}
                </div>

                {/* Especificaciones técnicas */}
                <div style={{ paddingLeft: 16, lineHeight: 1.65 }}>
                  {item.sistema_nombre && (
                    <div style={{ fontSize: 11, color: '#444' }}>Sistema: {item.sistema_nombre}</div>
                  )}
                  {(item.medida_ancho || item.medida_alto) && (
                    <div style={{ fontSize: 11, color: '#444' }}>
                      Medida: {item.medida_ancho ?? '—'} x {item.medida_alto ?? '—'} m
                    </div>
                  )}
                  {item.vidrio && (
                    <div style={{ fontSize: 11, color: '#444' }}>Vidrio: {item.vidrio}</div>
                  )}
                  {item.color && (
                    <div style={{ fontSize: 11, color: '#444' }}>Color: {item.color}</div>
                  )}
                  {item.accesorios && item.accesorios.length > 0 && (
                    <div style={{ fontSize: 11, color: '#444' }}>
                      Incluye: {item.accesorios.join(', ')}
                    </div>
                  )}
                  {item.notas && (
                    <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>{item.notas}</div>
                  )}

                  {/* Precio */}
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                      {fmt(precioTotal)}
                    </span>
                    {item.cantidad > 1 && (
                      <span style={{ fontSize: 10, color: '#888' }}>({fmt(precioUnitFinal)} c/u)</span>
                    )}
                    {item.incluye_instalacion && (
                      <span style={{ fontSize: 11, color: '#2d6a2d', fontWeight: 600 }}>
                        Incluye provision e instalacion
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total — mismo estilo que recibo (borde en lugar de fondo oscuro) */}
        <div style={{
          border: `2px solid ${NAVY}`, borderRadius: 10, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div>
            <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Total general
            </div>
            <div style={{ color: NAVY, fontSize: 28, fontWeight: 900, fontFamily: 'monospace', marginTop: 2 }}>
              {fmt(total)}
            </div>
          </div>
          {op.forma_pago && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Forma de pago
              </div>
              <div style={{ color: NAVY, fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                {op.forma_pago}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
                Beneficio por pago contado efectivo
              </div>
            </div>
          )}
        </div>

        {/* Observaciones */}
        {(op.notas || hayInstalacion) && (
          <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 12px', marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
              Observaciones
            </div>
            <div style={{ fontSize: 11, color: '#444', lineHeight: 1.7 }}>
              {hayInstalacion && (
                <div>- Algunas aberturas incluyen instalacion segun lo indicado en el detalle.</div>
              )}
              {op.notas && (
                <div style={{ whiteSpace: 'pre-wrap', marginTop: hayInstalacion ? 4 : 0 }}>{op.notas}</div>
              )}
            </div>
          </div>
        )}

        {/* Firma — igual que recibo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 8, fontSize: 11, color: '#666' }}>
              Firma y aclaración — {empresa?.nombre ?? 'Vendedor'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 8, fontSize: 11, color: '#666' }}>
              Firma y aclaración — Cliente
            </div>
          </div>
        </div>

        {/* Footer — mismo estilo que recibo */}
        <div style={{ borderTop: `2px solid ${RED}`, marginTop: 28, paddingTop: 12, textAlign: 'center', fontSize: 10, color: '#999' }}>
          {footerParts}
        </div>
      </div>
    </>
  );
}
