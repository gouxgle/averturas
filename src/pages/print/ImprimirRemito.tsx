import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '@/lib/api';

const NAVY  = '#031d49';
const RED   = '#e31e24';
const GREEN = '#16a34a';

const fmtFecha = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const CONFIG_HOJAS_LABEL: Record<string, string> = {
  hoja_simple: '1 hoja', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', puerta_pano_fijo: 'Con paño fijo',
  '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
};

const attrBool = (v: unknown): boolean | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase();
  if (s === 'si' || s === 'sí' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return null;
};

const MEDIO_LABEL: Record<string, string> = {
  retiro_local: 'Retiro en local', encomienda: 'Encomienda',
  flete_propio: 'Flete propio', flete_tercero: 'Transporte tercerizado',
  correo_argentino: 'Correo Argentino', otro: 'Otro',
};

const RECEPCION_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  conforme:          { label: 'CONFIRMADO CONFORME',           color: GREEN,    bg: '#dcfce7' },
  con_observaciones: { label: 'RECIBIDO CON OBSERVACIONES',    color: '#d97706', bg: '#fef3c7' },
  no_conforme:       { label: 'RECEPCIÓN CON PROBLEMAS',       color: RED,       bg: '#fee2e2' },
};

interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null; logo_url: string | null;
  instagram: string | null; website: string | null;
}

interface Item {
  descripcion: string; cantidad: number; color: string | null;
  medida_ancho: number | null; medida_alto: number | null;
  vidrio: string | null; premarco: boolean; accesorios: string[];
  tipo_abertura_nombre: string | null; sistema_nombre: string | null;
  producto_imagen_url: string | null;
  producto_atributos: Record<string, unknown> | null;
  notas: string | null; estado_producto?: string;
}

interface OpItem extends Item {
  precio_unitario: number; precio_instalacion: number; incluye_instalacion: boolean; precio_total: number;
}

interface Remito {
  id: string; numero: string; estado: string;
  medio_envio: string; transportista: string | null;
  nro_seguimiento: string | null; direccion_entrega: string | null;
  fecha_emision: string; fecha_entrega_est: string | null;
  notas: string | null;
  token_acceso?: string | null;
  recepcion_estado?: string | null;
  recepcion_at?: string | null;
  recepcion_obs?: string | null;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  operacion: { id: string; numero: string; tipo?: string } | null;
  items: Item[];
}

interface OperacionData { items: OpItem[] }

export function ImprimirRemito() {
  const { id } = useParams<{ id: string }>();
  const [empresa, setEmpresa]   = useState<Empresa | null>(null);
  const [remito,  setRemito]    = useState<Remito | null>(null);
  const [opItems, setOpItems]   = useState<OpItem[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<Empresa>('/empresa'),
      api.get<Remito>(`/remitos/${id}`),
    ]).then(async ([e, r]) => {
      setEmpresa(e);
      setRemito(r);
      if (r.operacion?.id) {
        const op = await api.get<OperacionData>(`/operaciones/${r.operacion.id}`);
        setOpItems(op.items ?? []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#aaa', fontFamily: 'Arial' }}>
      Cargando...
    </div>
  );
  if (!remito) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#aaa', fontFamily: 'Arial' }}>
      No encontrado
    </div>
  );

  const displayItems: Item[] = opItems.length > 0 ? opItems : remito.items;
  const cl = remito.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';
  const clienteDoc = cl.documento_nro
    ? (cl.tipo_persona === 'juridica' ? `CUIT: ${cl.documento_nro}` : `DNI: ${cl.documento_nro}`)
    : null;
  const recBadge = remito.recepcion_estado ? RECEPCION_BADGE[remito.recepcion_estado] : null;
  const proformaNumero = remito.operacion?.numero?.replace(/^OP-/, 'PRO-') ?? null;
  const appUrl = window.location.origin;
  const linkRemito = remito.token_acceso ? `${appUrl}/r/${remito.token_acceso}` : null;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm 12mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #e5e7eb; }
        .doc { background: white; }
        table { border-collapse: collapse; width: 100%; }
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

      {/* Documento */}
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 shadow-xl" style={{ minHeight: '297mm' }}>

        {/* HEADER */}
        <div style={{ padding: '20px 24px 16px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

            {/* Izquierda: logo + empresa */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <img src="/logochico.png" alt="Logo" style={{ height: 38 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div style={{ color: NAVY, fontSize: 17, fontWeight: 900, lineHeight: 1.1 }}>
                  {empresa?.nombre ?? ''}
                </div>
              </div>
              {empresa?.cuit && (
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>🪪 CUIT: {empresa.cuit}</div>
              )}
              {empresa?.telefono && (
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>📞 {empresa.telefono}</div>
              )}
              {empresa?.email && (
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>✉️ {empresa.email}</div>
              )}
              {empresa?.direccion && (
                <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>📍 {empresa.direccion}</div>
              )}
              {empresa?.instagram && (
                <div style={{ fontSize: 11, color: '#555' }}>📷 Instagram: {empresa.instagram}</div>
              )}
            </div>

            {/* Derecha: título + datos */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: NAVY, fontSize: 24, fontWeight: 900, letterSpacing: 1, lineHeight: 1, textTransform: 'uppercase' }}>
                Remito de Entrega
              </div>
              <div style={{
                display: 'inline-block', background: NAVY, color: 'white',
                fontWeight: 800, fontSize: 13, padding: '3px 14px', borderRadius: 6, marginTop: 6,
              }}>
                N°: {remito.numero}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                📅 <span>Fecha de emisión: {fmtFecha(remito.fecha_emision)}</span>
              </div>
              {remito.fecha_entrega_est && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  📋 <span>Fecha pactada: {fmtFecha(remito.fecha_entrega_est)}</span>
                </div>
              )}
              {proformaNumero && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  🔗 <span>Relacionado a Proforma: <strong style={{ color: NAVY }}>{proformaNumero}</strong></span>
                </div>
              )}
              {/* Badge estado recepción */}
              {recBadge ? (
                <div style={{
                  display: 'inline-block', marginTop: 6, padding: '3px 12px',
                  background: recBadge.bg, color: recBadge.color,
                  fontSize: 10, fontWeight: 800, borderRadius: 4, border: `1px solid ${recBadge.color}33`,
                }}>
                  Estado: {recBadge.label}
                </div>
              ) : (
                <div style={{
                  display: 'inline-block', marginTop: 6, padding: '3px 12px',
                  background: '#fef3c7', color: '#d97706',
                  fontSize: 10, fontWeight: 800, borderRadius: 4, border: '1px solid #fbbf2433',
                }}>
                  Estado: PENDIENTE DE CONFIRMACIÓN
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Línea navy */}
        <div style={{ height: 2, background: NAVY }} />

        {/* CLIENTE + ENTREGA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e5e7eb' }}>
          {/* Cliente */}
          <div style={{ padding: '14px 18px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: NAVY,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
              }}>👤</div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: '#9ca3af' }}>
                Datos del Cliente
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: RED, marginBottom: 4 }}>{clienteNombre}</div>
            {clienteDoc && cl.telefono && (
              <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>
                {clienteDoc} &nbsp;|&nbsp; Tel: {cl.telefono}
              </div>
            )}
            {clienteDoc && !cl.telefono && (
              <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>{clienteDoc}</div>
            )}
            {cl.email && <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>{cl.email}</div>}
            {(cl.direccion || cl.localidad) && (
              <div style={{ fontSize: 11, color: '#555' }}>
                {[cl.direccion, cl.localidad].filter(Boolean).join(' | ')}
              </div>
            )}
          </div>

          {/* Entrega */}
          <div style={{ padding: '14px 18px', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: NAVY,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
              }}>🚚</div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: '#9ca3af' }}>
                Datos de Entrega
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 11 }}>
              <div style={{ color: '#6b7280' }}>Tipo de entrega:</div>
              <div style={{ color: '#111827', fontWeight: 600 }}>{MEDIO_LABEL[remito.medio_envio] ?? remito.medio_envio}</div>
              {remito.fecha_entrega_est && <>
                <div style={{ color: '#6b7280' }}>Fecha pactada:</div>
                <div style={{ color: '#111827', fontWeight: 600 }}>{fmtFecha(remito.fecha_entrega_est)}</div>
              </>}
              {remito.transportista && <>
                <div style={{ color: '#6b7280' }}>Responsable de entrega:</div>
                <div style={{ color: '#111827', fontWeight: 600 }}>{remito.transportista}</div>
              </>}
              {remito.nro_seguimiento && <>
                <div style={{ color: '#6b7280' }}>N° seguimiento:</div>
                <div style={{ color: '#111827', fontWeight: 600 }}>{remito.nro_seguimiento}</div>
              </>}
              {remito.direccion_entrega && <>
                <div style={{ color: '#6b7280' }}>Dirección de entrega:</div>
                <div style={{ color: '#111827', fontWeight: 600 }}>{remito.direccion_entrega}</div>
              </>}
              {remito.notas && <>
                <div style={{ color: '#6b7280' }}>Observaciones:</div>
                <div style={{ color: '#111827', fontStyle: 'italic' }}>{remito.notas}</div>
              </>}
            </div>
          </div>
        </div>

        {/* TABLA ITEMS */}
        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <table>
            <thead>
              <tr style={{ background: NAVY }}>
                {[
                  { l: 'Ítem',     w: 36,  a: 'left'   },
                  { l: '',         w: 56,  a: 'left'   },
                  { l: 'Producto', w: undefined, a: 'left' },
                  { l: 'Cant.',    w: 44,  a: 'center' },
                  { l: 'Medida',   w: 80,  a: 'center' },
                  { l: 'Color',    w: 70,  a: 'center' },
                  { l: 'Detalle',  w: 110, a: 'left'   },
                  { l: 'Estado',   w: 80,  a: 'center' },
                ].map(({ l, w, a }) => (
                  <th key={l} style={{
                    padding: '8px 8px', color: 'white', fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase' as const, letterSpacing: 1, textAlign: a as 'left'|'center'|'right',
                    width: w, whiteSpace: 'nowrap' as const,
                  }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, i) => {
                const attr = item.producto_atributos ?? {};
                const hojasNum = attr.hojas ? `${attr.hojas} hojas` : null;
                const hojasConfig = attr.config_hojas
                  ? (CONFIG_HOJAS_LABEL[attr.config_hojas as string] ?? String(attr.config_hojas))
                  : null;
                const hojas = hojasNum ?? hojasConfig;
                const mosquitero = attrBool(attr.mosquitero);
                const reja = attrBool(attr.reja);
                const diseno = attr.diseno ? String(attr.diseno) : null;

                const detalle: string[] = [];
                if (hojas)               detalle.push(hojas);
                if (mosquitero !== null)  detalle.push(`Mosquitero: ${mosquitero ? 'Sí' : 'No'}`);
                if (reja === true)        detalle.push('Reja: Sí');
                if (diseno)              detalle.push(`Diseño: ${diseno}`);
                if (item.premarco)       detalle.push('Premarco');

                const medida = (item.medida_ancho || item.medida_alto)
                  ? `${item.medida_ancho ?? '—'}×${item.medida_alto ?? '—'}`
                  : '—';

                const estadoProd = (item as { estado_producto?: string }).estado_producto ?? 'nuevo';
                const estadoBadge = estadoProd === 'nuevo'
                  ? { label: 'Conforme', bg: '#dcfce7', color: GREEN }
                  : estadoProd === 'bueno'
                    ? { label: 'Bueno',   bg: '#dbeafe', color: '#2563eb' }
                    : { label: 'C/detalles', bg: '#fef3c7', color: '#d97706' };

                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', verticalAlign: 'middle' }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: '6px 6px', verticalAlign: 'middle' }}>
                      {item.producto_imagen_url ? (
                        <img src={item.producto_imagen_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb', display: 'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: 48, height: 48, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                          🪟
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{item.descripcion}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '1px 8px' }}>
                        {item.tipo_abertura_nombre && (
                          <span style={{ fontSize: 9.5, color: '#6b7280' }}>Tipo: {item.tipo_abertura_nombre}</span>
                        )}
                        {item.sistema_nombre && (
                          <span style={{ fontSize: 9.5, color: '#6b7280' }}>Línea: {item.sistema_nombre}</span>
                        )}
                        {item.vidrio && (
                          <span style={{ fontSize: 9.5, color: '#6b7280' }}>Vidrio: {item.vidrio}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                      {item.cantidad}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle', fontSize: 10.5, color: '#374151', fontWeight: 600 }}>
                      {medida}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle', fontSize: 10.5, color: '#374151' }}>
                      {item.color ?? '—'}
                    </td>
                    <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                      {detalle.length > 0 ? (
                        detalle.map((d, di) => (
                          <div key={di} style={{ fontSize: 9.5, color: '#6b7280', lineHeight: 1.5 }}>{d}</div>
                        ))
                      ) : <span style={{ fontSize: 9.5, color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{
                        display: 'inline-block', padding: '2px 10px',
                        background: estadoBadge.bg, color: estadoBadge.color,
                        fontSize: 9.5, fontWeight: 700, borderRadius: 12,
                      }}>
                        {estadoBadge.label}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* BARRA RESUMEN */}
        <div style={{
          margin: '14px 16px 0',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
        }}>
          {[
            { icon: '📦', title: 'Total de Ítems',       desc: `${displayItems.length} producto${displayItems.length !== 1 ? 's' : ''}` },
            { icon: '📋', title: 'Embalaje',              desc: 'Todos los productos se entregan embalados y protegidos.' },
            { icon: '🔍', title: 'Revisión al entregar',  desc: 'Verificar cantidad, medidas y estado de cada producto.' },
            { icon: '📷', title: 'Fotos referenciales',   desc: 'Las imágenes son ilustrativas. Los productos pueden variar ligeramente.' },
          ].map(({ icon, title, desc }, idx) => (
            <div key={title} style={{
              padding: '10px 12px',
              borderRight: idx < 3 ? '1px solid #e5e7eb' : undefined,
              background: idx % 2 === 0 ? 'white' : '#fafafa',
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 0.8, color: NAVY, marginBottom: 4 }}>
                {title}
              </div>
              <div style={{ fontSize: 9.5, color: '#6b7280', lineHeight: 1.4 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* SECCIÓN FIRMA + OBSERVACIONES + QR */}
        <div style={{
          margin: '14px 16px 0',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
        }}>
          {/* Col 1: Datos de entrega firma */}
          <div style={{ padding: '12px 14px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1, color: NAVY, marginBottom: 10 }}>
              Datos de Entrega
            </div>
            {[
              'Entregado por:',
              'DNI:',
              'Fecha:',
              'Hora:',
            ].map(lbl => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 9.5, color: '#6b7280', whiteSpace: 'nowrap' as const }}>{lbl}</span>
                <div style={{ flex: 1, borderBottom: '1px solid #d1d5db' }} />
              </div>
            ))}
            {/* Firma receptor */}
            <div style={{ marginTop: 8, paddingTop: 36, borderTop: '1px solid #d1d5db', textAlign: 'center', fontSize: 9, color: '#9ca3af' }}>
              Recibió conforme — Firma y aclaración
            </div>
          </div>

          {/* Col 2: Observaciones cliente */}
          <div style={{ padding: '12px 14px', borderRight: '1px solid #e5e7eb', background: '#fafafa' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1, color: NAVY, marginBottom: 8 }}>
              Observaciones del Cliente <span style={{ fontWeight: 400, color: '#9ca3af' }}>(Opcional)</span>
            </div>
            {remito.recepcion_obs ? (
              <div style={{ fontSize: 10, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {remito.recepcion_obs}
              </div>
            ) : (
              <div style={{ height: 80, border: '1px dashed #d1d5db', borderRadius: 4, background: 'white' }} />
            )}
          </div>

          {/* Col 3: QR */}
          <div style={{ padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1, color: NAVY, marginBottom: 8 }}>
              Escaneá y confirmá desde tu celular
            </div>
            {linkRemito ? (
              <>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(linkRemito)}&size=90x90&margin=2`}
                  alt="QR"
                  style={{ width: 90, height: 90, margin: '0 auto 6px', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ fontSize: 8.5, color: '#6b7280', marginBottom: 4 }}>
                  Escaneá el código QR o ingresá el enlace a continuación para confirmar la recepción de tu pedido.
                </div>
                <div style={{ fontSize: 8, color: '#2563eb', fontWeight: 600, wordBreak: 'break-all' as const }}>{linkRemito}</div>
              </>
            ) : (
              <div style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic', marginTop: 12 }}>
                Compartí el link para habilitar la confirmación digital
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{
          marginTop: 16, background: NAVY,
          padding: '10px 24px',
          display: 'flex', justifyContent: 'center',
          flexWrap: 'wrap' as const, gap: '0 28px',
          fontSize: 10, color: '#bfdbfe',
        }}>
          {empresa?.telefono  && <span>📞 {empresa.telefono}</span>}
          {empresa?.email     && <span>✉ {empresa.email}</span>}
          {empresa?.direccion && <span>📍 {empresa.direccion}</span>}
          {empresa?.instagram && <span>📷 {empresa.instagram}</span>}
          {empresa?.website   && <span>🌐 {empresa.website}</span>}
        </div>

      </div>
    </>
  );
}
