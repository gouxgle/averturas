import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '@/lib/api';

const NAVY  = '#031d49';
const RED   = '#e31e24';
const GREEN = '#16a34a';

const fmtM = (n: number) =>
  `$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const fmtFecha = (iso: string) =>
  new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

function numToWords(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return 'Cero pesos';
  const U = ['','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete',
    'dieciocho','diecinueve','veinte','veintiún','veintidós','veintitrés',
    'veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const D = ['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos',
    'seiscientos','setecientos','ochocientos','novecientos'];
  function lt1000(x: number): string {
    if (x === 0) return '';
    if (x === 100) return 'cien';
    const c = Math.floor(x / 100); const r = x % 100;
    const cStr = C[c];
    if (r === 0) return cStr;
    const pfx = c > 0 ? cStr + ' ' : '';
    if (r < 30) return pfx + U[r];
    const d2 = Math.floor(r / 10); const u = r % 10;
    return pfx + D[d2] + (u > 0 ? ' y ' + U[u] : '');
  }
  const M = Math.floor(n / 1_000_000);
  const K = Math.floor((n % 1_000_000) / 1_000);
  const R = n % 1_000;
  const parts: string[] = [];
  if (M > 0) parts.push(M === 1 ? 'un millón' : `${lt1000(M)} millones`);
  if (K > 0) parts.push(K === 1 ? 'mil' : `${lt1000(K)} mil`);
  if (R > 0) parts.push(lt1000(R));
  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + ' pesos';
}

const CONFIG_HOJAS_LABEL: Record<string, string> = {
  hoja_simple: '1 hoja', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', puerta_pano_fijo: 'Con paño fijo',
  '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
};

interface Empresa {
  nombre: string; cuit: string | null; telefono: string | null;
  email: string | null; direccion: string | null; logo_url: string | null;
  instagram: string | null; terminos_url: string | null;
}
interface Item {
  id: string; descripcion: string; cantidad: number;
  precio_unitario: number; precio_instalacion: number;
  incluye_instalacion: boolean; precio_total: number;
  medida_ancho: number | null; medida_alto: number | null;
  color: string | null; vidrio: string | null; premarco: boolean;
  accesorios: string[];
  tipo_abertura_nombre: string | null; sistema_nombre: string | null;
  notas: string | null;
  producto_atributos: Record<string, unknown> | null;
  producto_nombre: string | null;
  producto_imagen_url: string | null;
}
interface Operacion {
  id: string; numero: string; tipo: string; estado: string;
  forma_pago: string | null; tiempo_entrega: number | null;
  fecha_validez: string | null; notas: string | null;
  precio_total: number; created_at: string;
  forma_envio: string | null; costo_envio: number | null;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  items: Item[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const attrBool = (v: unknown): boolean | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase();
  if (s === 'si' || s === 'sí' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return null;
};

// ── Estilos de celda ──────────────────────────────────────────────────────────
const thStyle = (w?: number | string, align: 'left'|'center'|'right' = 'left'): React.CSSProperties => ({
  padding: '8px 10px',
  color: 'white',
  fontSize: 9,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  textAlign: align,
  width: w,
  whiteSpace: 'nowrap' as const,
});

const tdStyle = (align: 'left'|'center'|'right' = 'left', top = true): React.CSSProperties => ({
  padding: '9px 10px',
  textAlign: align,
  verticalAlign: top ? 'top' : 'middle',
  borderBottom: '1px solid #f0f0f0',
});

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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#aaa', fontFamily:'Arial' }}>
      Cargando...
    </div>
  );
  if (!op) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#aaa', fontFamily:'Arial' }}>
      No encontrado
    </div>
  );

  const c = op.cliente;
  const clienteNombre = c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '—')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim() || '—';
  const clienteDoc = c.documento_nro
    ? (c.tipo_persona === 'juridica' ? `CUIT: ${c.documento_nro}` : `DNI: ${c.documento_nro}`)
    : null;
  const clienteDireccion = [c.direccion, c.localidad].filter(Boolean).join(', ') || null;

  const fechaEmision   = fmtFecha(op.created_at);
  const fechaValidez   = op.fecha_validez ? fmtFecha(op.fecha_validez) : null;
  const proformaNumero = op.numero.replace(/^OP-/, 'PRO-');
  const subtotal   = op.items.reduce((s, it) => s + Number(it.precio_total), 0);
  const costoEnvio = op.forma_envio === 'envio_empresa' ? Number(op.costo_envio ?? 0) : 0;
  const total      = subtotal + costoEnvio;
  const esCuotas   = op.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';
  const instagram   = empresa?.instagram   ?? null;
  const terminosUrl = empresa?.terminos_url ?? null;

  // Condiciones: texto dinámico
  const condiciones = [
    fechaValidez ? `Precio válido hasta ${fechaValidez}` : 'Consultar vigencia del precio',
    'Productos sujetos a disponibilidad de stock',
    'Las medidas deben ser verificadas antes de confirmar',
    'La garantía aplica según condiciones comerciales',
    'Los reclamos deben informarse dentro de las 48 hs de recibido el producto',
  ];

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

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
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

      {/* ── Documento ───────────────────────────────────────────────────── */}
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 shadow-xl" style={{ minHeight: '297mm' }}>

        {/* ── HEADER (fondo blanco, igual que la imagen) ─────────────────── */}
        <div style={{ padding: '20px 24px 16px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

            {/* Izquierda: logo + empresa + contacto */}
            <div>
              {/* Logo + nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <img src="/logochico.png" alt="Logo" style={{ height: 38 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div>
                  <div style={{ color: NAVY, fontSize: 17, fontWeight: 900, lineHeight: 1.1, letterSpacing: 0.5 }}>
                    {empresa?.nombre ?? ''}
                  </div>
                </div>
              </div>

              {/* Contacto */}
              {empresa?.cuit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555', marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>🪪</span> CUIT: {empresa.cuit}
                </div>
              )}
              {empresa?.telefono && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555', marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>📞</span> {empresa.telefono}
                </div>
              )}
              {empresa?.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555', marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>✉️</span> {empresa.email}
                </div>
              )}
              {empresa?.direccion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555', marginBottom: 3 }}>
                  <span style={{ fontSize: 12 }}>📍</span> {empresa.direccion}
                </div>
              )}
              {instagram && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#555' }}>
                  <span style={{ fontSize: 12 }}>📷</span> Instagram: {instagram}
                </div>
              )}
            </div>

            {/* Derecha: PROFORMA + datos */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: RED, fontSize: 34, fontWeight: 900, letterSpacing: 2, lineHeight: 1, textTransform: 'uppercase' }}>
                PROFORMA
              </div>
              <div style={{ color: NAVY, fontWeight: 700, fontSize: 14, marginTop: 6 }}>
                N°: {proformaNumero}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                📅 <span>Fecha: {fechaEmision}</span>
              </div>
              {fechaValidez && (
                <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  ⏱ <span>Válido hasta: {fechaValidez}</span>
                </div>
              )}
              {op.tiempo_entrega && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  🚚 <span>Entrega estimada: {op.tiempo_entrega} días hábiles</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Línea separadora navy ──────────────────────────────────────── */}
        <div style={{ height: 2, background: NAVY }} />

        {/* ── CLIENTE + GRACIAS ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'white', borderBottom: `1px solid #e5e7eb` }}>
          {/* Cliente */}
          <div style={{ padding: '12px 18px', borderRight: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', background: '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
              }}>👤</div>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: '#9ca3af' }}>
                Cliente
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 3 }}>{clienteNombre}</div>
            {(clienteDoc || c.telefono) && (
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>
                {clienteDoc}{clienteDoc && c.telefono ? ' | ' : ''}{c.telefono && `Tel: ${c.telefono}`}
              </div>
            )}
            {c.email     && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>{c.email}</div>}
            {clienteDireccion && <div style={{ fontSize: 11, color: '#6b7280' }}>{clienteDireccion}</div>}
          </div>

          {/* Gracias */}
          <div style={{ padding: '12px 18px', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🤝</div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: '#9ca3af', marginBottom: 4 }}>
                Gracias por elegirnos
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                Nos comprometemos a brindarte la mejor calidad, atención y asesoramiento en cada proyecto.
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLA DE ÍTEMS ────────────────────────────────────────────── */}
        <div style={{ padding: '0 16px', marginTop: 14 }}>
          <table>
            <thead>
              <tr style={{ background: NAVY }}>
                <th style={thStyle(36)}>Ítem</th>
                <th style={thStyle(52)}></th>
                <th style={thStyle()}>Producto</th>
                <th style={thStyle(50, 'center')}>Cant.</th>
                <th style={thStyle(105, 'right')}>Precio Unit.</th>
                <th style={thStyle(105, 'right')}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {op.items.map((item, i) => {
                const attr    = item.producto_atributos ?? {};
                const nombre  = item.producto_nombre ?? item.descripcion;
                const pUnit   = Number(item.precio_unitario) +
                  (item.incluye_instalacion ? Number(item.precio_instalacion) : 0);

                const hojasNum    = attr.hojas ? `${attr.hojas} hojas` : null;
                const hojasConfig = attr.config_hojas
                  ? (CONFIG_HOJAS_LABEL[attr.config_hojas as string] ?? String(attr.config_hojas))
                  : null;

                const specs: Array<[string, string]> = [];
                if (item.tipo_abertura_nombre) specs.push(['Tipo',    item.tipo_abertura_nombre]);
                if (item.sistema_nombre)       specs.push(['Línea',   item.sistema_nombre]);
                if (item.color)                specs.push(['Color',   item.color]);
                if (item.vidrio)               specs.push(['Vidrio',  item.vidrio]);
                const hojas = hojasNum ?? hojasConfig;
                if (hojas)                     specs.push(['Hojas',   hojas]);
                if (item.medida_ancho || item.medida_alto)
                  specs.push(['Medidas', `${item.medida_ancho ?? '—'} × ${item.medida_alto ?? '—'} m`]);
                const mosquitero = attrBool(attr.mosquitero);
                if (mosquitero !== null) specs.push(['Mosquitero', mosquitero ? 'Sí' : 'No']);
                if (attrBool(attr.reja) === true) specs.push(['Reja', 'Sí']);
                if (attr.diseno) specs.push(['Diseño', String(attr.diseno)]);
                if (item.premarco) specs.push(['Premarco', 'Sí']);

                return (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={tdStyle('left')}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af' }}>{i + 1}</span>
                    </td>
                    <td style={{ ...tdStyle('center', false), padding: '6px 8px' }}>
                      {item.producto_imagen_url ? (
                        <img
                          src={item.producto_imagen_url}
                          alt=""
                          style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb', display: 'block' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div style={{ width: 44, height: 44, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          🪟
                        </div>
                      )}
                    </td>
                    <td style={tdStyle('left')}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{nombre}</div>
                      {specs.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '2px 10px' }}>
                          {specs.map(([lbl, val]) => (
                            <span key={lbl} style={{ fontSize: 9.5, color: '#6b7280' }}>
                              <span style={{ fontWeight: 600 }}>{lbl}:</span> {val}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.accesorios && item.accesorios.length > 0 && (
                        <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 2 }}>
                          <span style={{ fontWeight: 600 }}>Incluye:</span> {item.accesorios.join(' · ')}
                        </div>
                      )}
                      {item.incluye_instalacion && (
                        <div style={{ fontSize: 9.5, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                          ✓ Incluye provisión e instalación
                        </div>
                      )}
                      {item.notas && (
                        <div style={{ fontSize: 9.5, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 }}>{item.notas}</div>
                      )}
                    </td>
                    <td style={tdStyle('center', false)}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{item.cantidad}</span>
                    </td>
                    <td style={tdStyle('right', false)}>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{fmtM(pUnit)}</span>
                    </td>
                    <td style={tdStyle('right', false)}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: NAVY }}>{fmtM(Number(item.precio_total))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notas */}
        {op.notas && (
          <div style={{ margin: '10px 16px 0', padding: '7px 12px', background: '#fffbeb', borderLeft: `3px solid #fbbf24`, fontSize: 10.5, color: '#78350f' }}>
            <span style={{ fontWeight: 700 }}>Observaciones: </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{op.notas}</span>
          </div>
        )}

        {/* ── TOTAL ─────────────────────────────────────────────────────── */}
        <div style={{ margin: '14px 16px 0', background: NAVY, borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 4 }}>
                Total Final
              </div>
              <div style={{ color: 'white', fontSize: 26, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>
                {fmtM(total)}
              </div>
              {costoEnvio > 0 && (
                <div style={{ color: '#93c5fd', fontSize: 10, marginTop: 3 }}>
                  (productos {fmtM(subtotal)} + envío {fmtM(costoEnvio)})
                </div>
              )}
              <div style={{ color: '#bfdbfe', fontSize: 10, fontStyle: 'italic', marginTop: 4 }}>
                Son: {numToWords(total)}
              </div>
              {esCuotas && (
                <div style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 10px',
                  background: 'rgba(139,92,246,0.25)', color: '#c4b5fd',
                  fontSize: 10, fontWeight: 700, borderRadius: 5,
                }}>
                  3 cuotas de {fmtM(total / 3)}
                </div>
              )}
            </div>
            {op.forma_pago && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
                  Forma de pago
                </div>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {op.forma_pago}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CONDICIONES (3 columnas con borde) ────────────────────────── */}
        <div style={{
          margin: '14px 16px 0',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
        }}>
          {/* Col 1: Condiciones */}
          <div style={{ padding: '12px 14px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1, color: NAVY, marginBottom: 8 }}>
              Condiciones importantes
            </div>
            {condiciones.map((cond, i) => (
              <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5, fontSize: 9.5, color: '#4b5563', lineHeight: 1.4 }}>
                <span style={{ color: '#22c55e', flexShrink: 0, fontWeight: 700 }}>✓</span>
                <span>{cond}</span>
              </div>
            ))}
            {terminosUrl && (
              <div style={{ marginTop: 8, fontSize: 9, color: '#6b7280' }}>
                <span>Más info: </span>
                <a href={terminosUrl} style={{ color: NAVY, fontWeight: 600, textDecoration: 'underline' }}>{terminosUrl}</a>
              </div>
            )}
          </div>

          {/* Col 2: Tu compra */}
          <div style={{ padding: '12px 14px', background: '#f9fafb', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🛡️</div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 1, color: NAVY, marginBottom: 6 }}>
              Tu compra está protegida
            </div>
            <div style={{ fontSize: 9.5, color: '#6b7280', lineHeight: 1.5 }}>
              Trabajamos con materiales de calidad y garantía de fabricación en todos nuestros productos.
            </div>
          </div>

          {/* Col 3: Badges */}
          <div style={{ padding: '12px 14px' }}>
            {[
              { icon: '📦', color: '#16a34a', bg: '#dcfce7', title: 'EN STOCK',            desc: 'Productos listos para entrega' },
              { icon: '🚚', color: '#2563eb', bg: '#dbeafe', title: 'ENTREGA RÁPIDA',       desc: 'De 2 a 5 días hábiles' },
              { icon: '⭐', color: '#d97706', bg: '#fef3c7', title: 'CALIDAD GARANTIZADA',  desc: '12 meses en todos los productos' },
            ].map(({ icon, bg, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 9 }}>
                <div style={{
                  width: 26, height: 26, background: bg, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: NAVY }}>{title}</div>
                  <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA: 2 botones (sin opciones de rechazo) ──────────────────── */}
        <div style={{ margin: '14px 16px 0' }}>
          <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            ¿Querés avanzar con tu pedido?
          </div>
          <div style={{ fontSize: 10.5, color: '#6b7280', marginBottom: 12 }}>
            Aceptá la proforma y confirmá que leíste y aceptás los términos y condiciones de venta.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: GREEN, borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 11 }}>✓ ACEPTO LA PROFORMA</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 2 }}>
                Leí y acepto los términos y condiciones
              </div>
            </div>
            <div style={{ background: RED, borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 11 }}>✕ NO ACEPTO LA PROFORMA</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 2 }}>
                Quiero modificar / No estoy conforme
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER (barra navy oscura, igual que imagen) ───────────────── */}
        <div style={{
          marginTop: 16,
          background: NAVY,
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap' as const,
          gap: '0 28px',
          fontSize: 10,
          color: '#bfdbfe',
        }}>
          {empresa?.telefono  && <span>📞 {empresa.telefono}</span>}
          {empresa?.email     && <span>✉ {empresa.email}</span>}
          {empresa?.direccion && <span>📍 {empresa.direccion}</span>}
          {instagram          && <span>📷 {instagram}</span>}
        </div>

      </div>
    </>
  );
}
