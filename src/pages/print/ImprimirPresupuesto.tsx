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
  const fechaValidez = op.fecha_validez
    ? fmtFecha(op.fecha_validez + 'T12:00:00')
    : null;

  const proformaNumero = op.numero.replace(/^OP-/, 'PRO-');
  const total = op.items.reduce((s, it) => s + Number(it.precio_total), 0);
  const hayInstalacion = op.items.some(it => it.incluye_instalacion);

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
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 p-8 shadow-lg" style={{ minHeight: '297mm' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              {empresa?.logo_url && (
                <img src={empresa.logo_url} alt="Logo" style={{ height: 36 }} />
              )}
              <div style={{ color: NAVY, fontSize: 15, fontWeight: 900, letterSpacing: -0.3 }}>{empresa?.nombre ?? ''}</div>
            </div>
            {empresa?.cuit     && <div style={{ color: '#555', fontSize: 11 }}>CUIT: {empresa.cuit}</div>}
            {empresa?.telefono && <div style={{ color: '#555', fontSize: 11 }}>Tel: {empresa.telefono}</div>}
            {empresa?.email    && <div style={{ color: '#555', fontSize: 11 }}>{empresa.email}</div>}
            {empresa?.direccion && <div style={{ color: '#555', fontSize: 11 }}>{empresa.direccion}</div>}
            <div style={{ color: '#555', fontSize: 11 }}>📲 Instagram: @cesarbritez.ok</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: RED, fontSize: 26, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              Proforma
            </div>
            <div style={{ color: NAVY, fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              N°: {proformaNumero}
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>Fecha: {fechaEmision}</div>
            {fechaValidez && (
              <div style={{ color: RED, fontSize: 11, fontWeight: 600 }}>Válido hasta: {fechaValidez}</div>
            )}
            {op.tiempo_entrega && (
              <div style={{ color: '#666', fontSize: 11 }}>Entrega estimada: {op.tiempo_entrega} días</div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ backgroundColor: NAVY, height: 2, marginBottom: 10 }} />

        {/* Cliente — 2 líneas */}
        <div style={{ backgroundColor: '#f0f4fa', borderRadius: 6, padding: '7px 12px', marginBottom: 14, borderLeft: `3px solid ${NAVY}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 3 }}>Cliente</div>
          {/* Línea 1: nombre + doc */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{clienteNombre}</span>
            {clienteDoc && <span style={{ fontSize: 11, color: '#555' }}>{clienteDoc}</span>}
          </div>
          {/* Línea 2: tel + email */}
          {(c.telefono || c.email) && (
            <div style={{ display: 'flex', gap: 20, fontSize: 11, color: '#555' }}>
              {c.telefono && <span>Tel: {c.telefono}</span>}
              {c.email    && <span>{c.email}</span>}
            </div>
          )}
          {/* Línea 3: dirección */}
          {clienteDireccion && (
            <div style={{ fontSize: 11, color: '#555' }}>{clienteDireccion}</div>
          )}
        </div>

        {/* Items — sección DETALLE */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, marginBottom: 10 }}>
            🔹 Detalle
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
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: i < op.items.length - 1 ? '1px solid #e8e8e8' : 'none',
              }}>
                {/* Nombre del producto */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>*</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                    {titulo}
                  </span>
                  {item.cantidad > 1 && (
                    <span style={{ fontSize: 11, color: '#888' }}>× {item.cantidad}</span>
                  )}
                </div>

                {/* Detalles técnicos */}
                <div style={{ paddingLeft: 14, lineHeight: 1.6 }}>
                  {item.sistema_nombre && (
                    <div style={{ fontSize: 11, color: '#444' }}>Sistema: {item.sistema_nombre}</div>
                  )}
                  {(item.medida_ancho || item.medida_alto) && (
                    <div style={{ fontSize: 11, color: '#444' }}>
                      Medida: {item.medida_ancho ?? '—'} × {item.medida_alto ?? '—'} m
                    </div>
                  )}
                  {item.vidrio && (
                    <div style={{ fontSize: 11, color: '#444' }}>Vidrio: {item.vidrio}</div>
                  )}
                  {item.accesorios && item.accesorios.length > 0 && (
                    <div style={{ fontSize: 11, color: '#444' }}>
                      Accesorios: Incluye {item.accesorios.join(' + ')}
                    </div>
                  )}
                  {item.color && (
                    <div style={{ fontSize: 11, color: '#444' }}>Color: {item.color}</div>
                  )}
                  {item.notas && (
                    <div style={{ fontSize: 10, color: '#888', fontStyle: 'italic' }}>{item.notas}</div>
                  )}

                  {/* Precio + instalación */}
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                      💰 {fmt(precioTotal)}
                    </span>
                    {item.cantidad > 1 && (
                      <span style={{ fontSize: 10, color: '#888' }}>
                        ({fmt(precioUnitFinal)} c/u)
                      </span>
                    )}
                    {item.incluye_instalacion && (
                      <span style={{ fontSize: 11, color: '#2d6a2d', fontWeight: 600 }}>
                        ✔️ Incluye provisión e instalación
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen total */}
        <div style={{
          backgroundColor: NAVY, borderRadius: 8, padding: '10px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            💰 Total general
          </div>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 900, fontFamily: 'monospace' }}>
            {fmt(total)}
          </div>
        </div>

        {/* Forma de pago + Observaciones — fila compacta */}
        <div style={{ display: 'grid', gridTemplateColumns: op.forma_pago ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 16 }}>
          {op.forma_pago && (
            <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 5 }}>
                💳 Forma de pago
              </div>
              <div style={{ fontSize: 11, color: '#333', lineHeight: 1.7 }}>
                <div>✔️ {op.forma_pago}</div>
                <div>✔️ Beneficio por pago contado efectivo</div>
              </div>
            </div>
          )}
          {(op.notas || hayInstalacion) && (
            <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 5 }}>
                📝 Observaciones
              </div>
              <div style={{ fontSize: 11, color: '#444', lineHeight: 1.7 }}>
                {hayInstalacion && (
                  <div>• Algunas aberturas incluyen instalación según lo indicado</div>
                )}
                {op.notas && (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{op.notas}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Firma */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 7, fontSize: 10, color: '#666' }}>
              Firma y aclaración — Vendedor
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #aaa', paddingTop: 7, fontSize: 10, color: '#666' }}>
              Firma y aclaración — Cliente
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `2px solid ${RED}`, marginTop: 20, paddingTop: 10, textAlign: 'center', fontSize: 9, color: '#999' }}>
          {[empresa?.nombre, empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.telefono ? `Tel: ${empresa.telefono}` : null, empresa?.email, empresa?.direccion, '📲 @cesarbritez.ok'].filter(Boolean).join(' · ')}
        </div>
      </div>
    </>
  );
}
