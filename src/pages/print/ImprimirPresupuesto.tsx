import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { api } from '@/lib/api';

const NAVY = '#031d49';
const RED  = '#e31e24';

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
    const d = Math.floor(r / 10); const u = r % 10;
    return pfx + D[d] + (u > 0 ? ' y ' + U[u] : '');
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
  instagram: string | null;
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#aaa', fontFamily: 'Arial' }}>
      Cargando...
    </div>
  );
  if (!op) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#aaa', fontFamily: 'Arial' }}>
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
  const clienteDireccion = [c.direccion, c.localidad].filter(Boolean).join(' | ') || null;

  const fechaEmision = fmtFecha(op.created_at);
  const fechaValidez = op.fecha_validez ? fmtFecha(op.fecha_validez) : null;
  const proformaNumero = op.numero.replace(/^OP-/, 'PRO-');
  const subtotal   = op.items.reduce((s, it) => s + Number(it.precio_total), 0);
  const costoEnvio = op.forma_envio === 'envio_empresa' ? Number(op.costo_envio ?? 0) : 0;
  const total      = subtotal + costoEnvio;
  const esCuotas   = op.forma_pago === 'Tarjeta de crédito 3 cuotas sin interés';
  const instagram  = (empresa as any)?.instagram ?? null;

  const attrBool = (v: unknown): boolean | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).toLowerCase();
    if (s === 'si' || s === 'sí' || s === 'true' || s === '1') return true;
    if (s === 'no' || s === 'false' || s === '0') return false;
    return null;
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 14mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #f0f0f0; }
        .doc { background: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { vertical-align: top; }
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

      {/* Documento */}
      <div className="doc max-w-[210mm] mx-auto mt-16 mb-8 shadow-lg" style={{ minHeight: '297mm' }}>

        {/* ── HEADER ───────────────────────────────────────────────────── */}
        <div style={{ background: NAVY, padding: '18px 22px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Empresa */}
            <div>
              <img src="/logochico.png" alt="Logo"
                style={{ height: 36, marginBottom: 10, opacity: 0.9 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {empresa?.cuit && (
                <div style={{ color: '#93c5fd', fontSize: 11, marginBottom: 2 }}>
                  <strong>CUIT:</strong> {empresa.cuit}
                </div>
              )}
              {empresa?.telefono && (
                <div style={{ color: '#93c5fd', fontSize: 11, marginBottom: 2 }}>📞 {empresa.telefono}</div>
              )}
              {empresa?.email && (
                <div style={{ color: '#93c5fd', fontSize: 11, marginBottom: 2 }}>✉ {empresa.email}</div>
              )}
              {empresa?.direccion && (
                <div style={{ color: '#93c5fd', fontSize: 11, marginBottom: 2 }}>📍 {empresa.direccion}</div>
              )}
              {instagram && (
                <div style={{ color: '#93c5fd', fontSize: 11 }}>Instagram: {instagram}</div>
              )}
            </div>

            {/* PROFORMA */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: RED, fontSize: 30, fontWeight: 900, letterSpacing: 2, lineHeight: 1, marginBottom: 6 }}>
                PROFORMA
              </div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>N°: {proformaNumero}</div>
              <div style={{ color: '#bfdbfe', fontSize: 11, marginTop: 6 }}>📅 Fecha: {fechaEmision}</div>
              {fechaValidez && (
                <div style={{ color: '#fcd34d', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                  ⏱ Válido hasta: {fechaValidez}
                </div>
              )}
              {op.tiempo_entrega && (
                <div style={{ color: '#bfdbfe', fontSize: 11, marginTop: 2 }}>
                  🚚 Entrega estimada: {op.tiempo_entrega} días hábiles
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Línea roja separadora */}
        <div style={{ height: 3, background: RED }} />

        {/* ── CLIENTE + GRACIAS ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e5e7eb' }}>
          {/* Cliente */}
          <div style={{ padding: '12px 16px', borderRight: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>👤</div>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af' }}>
                Cliente
              </span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 3 }}>{clienteNombre}</div>
            {(clienteDoc || c.telefono) && (
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>
                {clienteDoc}{clienteDoc && c.telefono ? ' | ' : ''}
                {c.telefono && `Tel: ${c.telefono}`}
              </div>
            )}
            {c.email     && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>{c.email}</div>}
            {clienteDireccion && <div style={{ fontSize: 11, color: '#6b7280' }}>{clienteDireccion}</div>}
          </div>

          {/* Gracias */}
          <div style={{ padding: '12px 16px', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🤝</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginBottom: 4 }}>
                Gracias por elegirnos
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                Nos comprometemos a brindarte la mejor calidad, atención y asesoramiento en cada proyecto.
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLA DE ÍTEMS ────────────────────────────────────────────── */}
        <div style={{ padding: '0 22px', marginTop: 18 }}>
          <table>
            <thead>
              <tr style={{ background: NAVY }}>
                <th style={{ width: 42, padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left' }}>Ítem</th>
                <th style={{ padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left' }}>Producto</th>
                <th style={{ width: 52, padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>Cant.</th>
                <th style={{ width: 110, padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Precio Unit.</th>
                <th style={{ width: 110, padding: '8px 10px', color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {op.items.map((item, i) => {
                const attr = item.producto_atributos ?? {};
                const nombre = item.producto_nombre ?? item.descripcion;
                const pUnit = Number(item.precio_unitario) +
                  (item.incluye_instalacion ? Number(item.precio_instalacion) : 0);

                const hojasNum    = attr.hojas ? `${attr.hojas} hojas` : null;
                const hojasConfig = attr.config_hojas
                  ? (CONFIG_HOJAS_LABEL[attr.config_hojas as string] ?? String(attr.config_hojas))
                  : null;
                const hojas = hojasNum ?? hojasConfig;

                const specs: Array<[string, string]> = [];
                if (item.tipo_abertura_nombre) specs.push(['Tipo',    item.tipo_abertura_nombre]);
                if (item.sistema_nombre)       specs.push(['Línea',   item.sistema_nombre]);
                if (item.color)                specs.push(['Color',   item.color]);
                if (item.vidrio)               specs.push(['Vidrio',  item.vidrio]);
                if (hojas)                     specs.push(['Hojas',   hojas]);
                if (item.medida_ancho || item.medida_alto)
                  specs.push(['Medidas', `${item.medida_ancho ?? '—'} × ${item.medida_alto ?? '—'} m`]);
                const mosquitero = attrBool(attr.mosquitero);
                if (mosquitero !== null) specs.push(['Mosquitero', mosquitero ? 'Sí' : 'No']);
                const reja = attrBool(attr.reja);
                if (reja === true) specs.push(['Reja', 'Sí']);
                if (attr.linea)   specs.push(['Línea',   String(attr.linea)]);
                if (attr.diseno)  specs.push(['Diseño',  String(attr.diseno)]);
                if (item.premarco) specs.push(['Premarco', 'Sí']);

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 700, color: '#d1d5db' }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{nombre}</div>
                      {specs.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                          {specs.map(([lbl, val]) => (
                            <span key={lbl} style={{ fontSize: 10, color: '#6b7280' }}>
                              <span style={{ fontWeight: 600 }}>{lbl}:</span> {val}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.accesorios && item.accesorios.length > 0 && (
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                          <span style={{ fontWeight: 600 }}>Incluye:</span> {item.accesorios.join(' · ')}
                        </div>
                      )}
                      {item.incluye_instalacion && (
                        <div style={{ fontSize: 10, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                          ✓ Incluye provisión e instalación
                        </div>
                      )}
                      {item.notas && (
                        <div style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 }}>
                          {item.notas}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 600, color: '#374151', textAlign: 'center' }}>
                      {item.cantidad}
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtM(pUnit)}
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 800, color: NAVY, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {fmtM(Number(item.precio_total))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notas / Observaciones */}
        {op.notas && (
          <div style={{ margin: '10px 22px 0', padding: '8px 12px', background: '#fffbeb', borderLeft: '3px solid #fbbf24', fontSize: 11, color: '#92400e' }}>
            <span style={{ fontWeight: 700 }}>Observaciones: </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{op.notas}</span>
          </div>
        )}

        {/* ── TOTAL ────────────────────────────────────────────────────── */}
        <div style={{ margin: '16px 22px 0', background: NAVY, borderRadius: 8, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Total Final
              </div>
              <div style={{ color: 'white', fontSize: 26, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>
                {fmtM(total)}
              </div>
              {costoEnvio > 0 && (
                <div style={{ color: '#93c5fd', fontSize: 10, marginTop: 4 }}>
                  (productos {fmtM(subtotal)} + envío {fmtM(costoEnvio)})
                </div>
              )}
              <div style={{ color: '#93c5fd', fontSize: 10, fontStyle: 'italic', marginTop: 4 }}>
                Son: {numToWords(total)}
              </div>
              {esCuotas && (
                <div style={{
                  display: 'inline-block', marginTop: 6, padding: '2px 10px',
                  background: 'rgba(139,92,246,0.25)', color: '#c4b5fd',
                  fontSize: 11, fontWeight: 700, borderRadius: 6,
                }}>
                  3 cuotas de {fmtM(total / 3)}
                </div>
              )}
            </div>
            {op.forma_pago && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Forma de pago
                </div>
                <div style={{ color: 'white', fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                  {op.forma_pago}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CONDICIONES ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, margin: '16px 22px 0', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {/* Condiciones importantes */}
          <div style={{ padding: '12px 14px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: NAVY, marginBottom: 8 }}>
              Condiciones importantes
            </div>
            {[
              fechaValidez ? `Precio válido hasta ${fechaValidez}` : 'Precio válido según lo indicado',
              'Productos sujetos a disponibilidad de stock',
              'Las medidas deben ser verificadas antes de confirmar',
              'La garantía aplica según condiciones comerciales',
              'Los reclamos deben informarse dentro de las 48 hs de recibido el producto',
            ].map((cond, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5, fontSize: 10, color: '#4b5563', lineHeight: 1.4 }}>
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>✓</span>
                <span>{cond}</span>
              </div>
            ))}
          </div>

          {/* Tu compra está protegida */}
          <div style={{ padding: '12px 14px', borderRight: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🛡️</div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: NAVY, marginBottom: 6 }}>
              Tu compra está protegida
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>
              Trabajamos con materiales de calidad y garantía de fabricación.
            </div>
          </div>

          {/* Badges derecha */}
          <div style={{ padding: '12px 14px' }}>
            {[
              { icon: '📦', title: 'EN STOCK',             desc: 'Productos listos para entrega' },
              { icon: '🚚', title: 'ENTREGA RÁPIDA',        desc: 'De 2 a 5 días hábiles' },
              { icon: '⭐', title: 'CALIDAD GARANTIZADA',   desc: '12 meses en todos los productos' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, background: '#f3f4f6', borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>{title}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div style={{
          margin: '16px 22px 22px',
          borderTop: `2px solid ${RED}`,
          paddingTop: 10,
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '0 24px',
          fontSize: 10,
          color: '#9ca3af',
        }}>
          {empresa?.telefono  && <span>📞 {empresa.telefono}</span>}
          {empresa?.email     && <span>✉ {empresa.email}</span>}
          {empresa?.direccion && <span>📍 {empresa.direccion}</span>}
          {instagram          && <span>Instagram: {instagram}</span>}
        </div>

      </div>
    </>
  );
}
