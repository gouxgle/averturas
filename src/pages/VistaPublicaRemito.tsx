import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const NAVY  = '#031d49';
const RED   = '#e31e24';
const GREEN = '#16a34a';

const API_BASE = '/api';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const fmtFecha = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const CONFIG_HOJAS_LABEL: Record<string, string> = {
  hoja_simple: '1 hoja', hoja_y_media: 'Hoja y media',
  dos_hojas: '2 hojas iguales', '2_hojas': '2 hojas', '3_hojas': '3 hojas', '4_hojas': '4 hojas',
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

interface Remito {
  id: string; numero: string; estado: string;
  medio_envio: string; transportista: string | null;
  nro_seguimiento: string | null; direccion_entrega: string | null;
  fecha_emision: string; fecha_entrega_est: string | null;
  notas: string | null;
  recepcion_estado: string | null;
  recepcion_at: string | null;
  recepcion_obs: string | null;
  cliente: {
    nombre: string | null; apellido: string | null; razon_social: string | null;
    tipo_persona: string; telefono: string | null; email: string | null;
    direccion: string | null; localidad: string | null; documento_nro: string | null;
  };
  operacion: { id: string; numero: string } | null;
  empresa: Empresa;
  items: Item[];
}

export function VistaPublicaRemito() {
  const { token } = useParams<{ token: string }>();
  const [remito,   setRemito]   = useState<Remito | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [estadoSel,   setEstadoSel]   = useState<string | null>(null);
  const [obs,          setObs]         = useState('');
  const [confirmado,   setConfirmado]  = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<Remito>(`/pub/remito/${token}`)
      .then(r => { setRemito(r); setLoading(false); })
      .catch(() => { setError('Link inválido o expirado.'); setLoading(false); });
  }, [token]);

  async function confirmar() {
    if (!estadoSel || !token) return;
    if (estadoSel === 'con_observaciones' && !obs.trim()) {
      alert('Por favor describí brevemente la observación.');
      return;
    }
    setConfirmando(true);
    try {
      const r = await apiFetch<{ ok: boolean; ya_confirmado: boolean; estado?: string }>(
        `/pub/remito/${token}/confirmar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: estadoSel, observaciones: obs }),
        }
      );
      if (r.ok) {
        setConfirmado(true);
        if (remito) setRemito({ ...remito, recepcion_estado: estadoSel, recepcion_obs: obs });
      }
    } catch {
      alert('Error al confirmar. Intentá de nuevo.');
    } finally {
      setConfirmando(false);
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#6b7280' }}>
      Cargando...
    </div>
  );
  if (error || !remito) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Link no encontrado</div>
      <div style={{ fontSize: 14, color: '#6b7280' }}>{error ?? 'Este link no existe o ya venció.'}</div>
    </div>
  );

  const emp = remito.empresa;
  const cl  = remito.cliente;
  const clienteNombre = cl.tipo_persona === 'juridica'
    ? (cl.razon_social ?? '—')
    : `${cl.apellido ?? ''} ${cl.nombre ?? ''}`.trim() || '—';
  const clienteDoc = cl.documento_nro
    ? (cl.tipo_persona === 'juridica' ? `CUIT: ${cl.documento_nro}` : `DNI: ${cl.documento_nro}`)
    : null;
  const proformaNumero = remito.operacion?.numero?.replace(/^OP-/, 'PRO-') ?? null;
  const yaConfirmado   = !!remito.recepcion_estado || confirmado;

  const RECEPCION_INFO: Record<string, { icon: string; titulo: string; subtitulo: string; bg: string; border: string; color: string }> = {
    conforme:          { icon: '✓', titulo: 'ESTOY CONFORME',           subtitulo: 'Recibí todo en perfectas condiciones',        bg: '#f0fdf4', border: GREEN,    color: GREEN    },
    con_observaciones: { icon: '!', titulo: 'RECIBÍ CON OBSERVACIONES', subtitulo: 'Hubo algún detalle a tener en cuenta',        bg: '#fffbeb', border: '#d97706', color: '#d97706' },
    no_conforme:       { icon: '✕', titulo: 'NO RECIBÍ CORRECTAMENTE',  subtitulo: 'Faltan productos o hay problemas',            bg: '#fef2f2', border: RED,       color: RED      },
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif', background: '#f3f4f6', minHeight: '100vh', paddingBottom: 40 }}>

      {/* HEADER */}
      <div style={{ background: 'white', padding: '20px 24px 16px', maxWidth: 860, margin: '0 auto 0', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <img src="/logochico.png" alt="Logo" style={{ height: 36 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div style={{ color: NAVY, fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{emp.nombre}</div>
            </div>
            {emp.cuit     && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>🪪 CUIT: {emp.cuit}</div>}
            {emp.telefono && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>📞 {emp.telefono}</div>}
            {emp.email    && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>✉️ {emp.email}</div>}
            {emp.direccion && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>📍 {emp.direccion}</div>}
            {emp.instagram && <div style={{ fontSize: 11, color: '#6b7280' }}>📷 Instagram: {emp.instagram}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: NAVY, fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
              Remito de Entrega
            </div>
            <div style={{
              display: 'inline-block', background: NAVY, color: 'white',
              fontWeight: 800, fontSize: 14, padding: '4px 16px', borderRadius: 6, marginTop: 4,
            }}>
              N°: {remito.numero}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
              📅 Fecha de emisión: {fmtFecha(remito.fecha_emision)}
            </div>
            {remito.fecha_entrega_est && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                📋 Fecha pactada: {fmtFecha(remito.fecha_entrega_est)}
              </div>
            )}
            {proformaNumero && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                🔗 Relacionado a Proforma: <strong style={{ color: NAVY }}>{proformaNumero}</strong>
              </div>
            )}
            {yaConfirmado && remito.recepcion_estado ? (
              <div style={{
                display: 'inline-block', marginTop: 6, padding: '4px 14px',
                background: RECEPCION_INFO[remito.recepcion_estado]?.bg ?? '#f9fafb',
                color: RECEPCION_INFO[remito.recepcion_estado]?.color ?? '#374151',
                fontSize: 10, fontWeight: 800, borderRadius: 4,
                border: `1px solid ${RECEPCION_INFO[remito.recepcion_estado]?.border ?? '#e5e7eb'}44`,
              }}>
                ✓ Confirmado
              </div>
            ) : (
              <div style={{
                display: 'inline-block', marginTop: 6, padding: '4px 14px',
                background: '#fef3c7', color: '#d97706',
                fontSize: 10, fontWeight: 800, borderRadius: 4,
              }}>
                Estado: PENDIENTE DE CONFIRMACIÓN
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 0' }}>
        <div style={{ height: 3, background: NAVY }} />

        {/* CLIENTE + ENTREGA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ padding: '16px 20px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#9ca3af' }}>Datos del Cliente</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: RED, marginBottom: 6 }}>{clienteNombre}</div>
            {clienteDoc && cl.telefono && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{clienteDoc} &nbsp;|&nbsp; Tel: {cl.telefono}</div>
            )}
            {clienteDoc && !cl.telefono && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{clienteDoc}</div>}
            {cl.email && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{cl.email}</div>}
            {(cl.direccion || cl.localidad) && (
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {[cl.direccion, cl.localidad].filter(Boolean).join(' | ')}
              </div>
            )}
          </div>
          <div style={{ padding: '16px 20px', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🚚</div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#9ca3af' }}>Datos de Entrega</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12 }}>
              <span style={{ color: '#9ca3af' }}>Tipo de entrega:</span>
              <span style={{ color: '#111827', fontWeight: 600 }}>{MEDIO_LABEL[remito.medio_envio] ?? remito.medio_envio}</span>
              {remito.fecha_entrega_est && <>
                <span style={{ color: '#9ca3af' }}>Fecha pactada:</span>
                <span style={{ color: '#111827', fontWeight: 600 }}>{fmtFecha(remito.fecha_entrega_est)}</span>
              </>}
              {remito.transportista && <>
                <span style={{ color: '#9ca3af' }}>Responsable:</span>
                <span style={{ color: '#111827', fontWeight: 600 }}>{remito.transportista}</span>
              </>}
              {remito.direccion_entrega && <>
                <span style={{ color: '#9ca3af' }}>Dirección:</span>
                <span style={{ color: '#111827', fontWeight: 600 }}>{remito.direccion_entrega}</span>
              </>}
              {remito.notas && <>
                <span style={{ color: '#9ca3af' }}>Observaciones:</span>
                <span style={{ color: '#374151', fontStyle: 'italic' }}>{remito.notas}</span>
              </>}
            </div>
          </div>
        </div>

        {/* TABLA ITEMS */}
        <div style={{ background: 'white', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: NAVY }}>
                {['Ítem','','Producto','Cant.','Medida','Color','Detalle','Estado'].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 10px', color: 'white', fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.8,
                    textAlign: [1, 2].includes(i) ? 'left' : 'center',
                    whiteSpace: 'nowrap',
                    width: i === 0 ? 40 : i === 1 ? 60 : i === 7 ? 90 : undefined,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {remito.items.map((item, i) => {
                const attr = item.producto_atributos ?? {};
                const hojasNum = attr.hojas ? `${attr.hojas} hojas` : null;
                const hojasConfig = attr.config_hojas ? (CONFIG_HOJAS_LABEL[attr.config_hojas as string] ?? String(attr.config_hojas)) : null;
                const hojas = hojasNum ?? hojasConfig;
                const mosquitero = attrBool(attr.mosquitero);
                const reja = attrBool(attr.reja);
                const diseno = attr.diseno ? String(attr.diseno) : null;

                const detalle: string[] = [];
                if (hojas)              detalle.push(hojas);
                if (mosquitero !== null) detalle.push(`Mosquitero: ${mosquitero ? 'Sí' : 'No'}`);
                if (reja === true)       detalle.push('Reja: Sí');
                if (diseno)             detalle.push(`Diseño: ${diseno}`);
                if (item.premarco)      detalle.push('Premarco');

                const medida = (item.medida_ancho || item.medida_alto)
                  ? `${item.medida_ancho ?? '—'}×${item.medida_alto ?? '—'}`
                  : '—';

                const estadoProd = item.estado_producto ?? 'nuevo';
                const estadoBadge = estadoProd === 'nuevo'
                  ? { label: 'Conforme', bg: '#dcfce7', color: GREEN }
                  : estadoProd === 'bueno'
                    ? { label: 'Bueno', bg: '#dbeafe', color: '#2563eb' }
                    : { label: 'C/detalles', bg: '#fef3c7', color: '#d97706' };

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>{i + 1}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      {item.producto_imagen_url ? (
                        <img src={item.producto_imagen_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', display: 'block', margin: '0 auto' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: 52, height: 52, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto' }}>🪟</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{item.descripcion}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1px 10px' }}>
                        {item.tipo_abertura_nombre && <span style={{ fontSize: 11, color: '#6b7280' }}>Tipo: {item.tipo_abertura_nombre}</span>}
                        {item.sistema_nombre && <span style={{ fontSize: 11, color: '#6b7280' }}>Línea: {item.sistema_nombre}</span>}
                        {item.vidrio && <span style={{ fontSize: 11, color: '#6b7280' }}>Vidrio: {item.vidrio}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#374151' }}>{item.cantidad}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#374151', fontWeight: 600 }}>{medida}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: '#374151' }}>{item.color ?? '—'}</td>
                    <td style={{ padding: '10px' }}>
                      {detalle.length > 0 ? detalle.map((d, di) => (
                        <div key={di} style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{d}</div>
                      )) : <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block', padding: '3px 12px',
                        background: estadoBadge.bg, color: estadoBadge.color,
                        fontSize: 11, fontWeight: 700, borderRadius: 14,
                      }}>{estadoBadge.label}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* BARRA RESUMEN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'white', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
          {[
            { icon: '📦', title: 'Total de Ítems',       desc: `${remito.items.length} producto${remito.items.length !== 1 ? 's' : ''}` },
            { icon: '📋', title: 'Embalaje',              desc: 'Todos los productos se entregan embalados y protegidos.' },
            { icon: '🔍', title: 'Revisión al entregar',  desc: 'Verificar cantidad, medidas y estado de cada producto.' },
            { icon: '📷', title: 'Fotos referenciales',   desc: 'Las imágenes son ilustrativas. Los productos pueden variar ligeramente.' },
          ].map(({ icon, title, desc }, idx) => (
            <div key={title} style={{
              padding: '14px 16px',
              borderRight: idx < 3 ? '1px solid #e5e7eb' : undefined,
              background: idx % 2 === 0 ? 'white' : '#fafafa',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: NAVY, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* CONFIRMACIÓN DE RECEPCIÓN */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'white', borderBottom: '1px solid #e5e7eb' }}>

          {/* Izquierda: instrucciones */}
          <div style={{ padding: '20px 24px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Confirmación de Recepción
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
              Para finalizar el proceso de entrega, te pedimos confirmar que recibiste correctamente los productos detallados.
            </div>
            {[
              'Recibí la mercadería detallada en este remito.',
              'Verificá cantidad y estado visible de los productos.',
              'Cualquier observación debe informarse dentro de las 48 hs.',
              'La recepción no reemplaza la garantía por fallas de fabricación.',
            ].map((txt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
                <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span>{txt}</span>
              </div>
            ))}
            <div style={{
              marginTop: 14, padding: '10px 14px', background: '#fef3c7',
              borderLeft: '3px solid #f59e0b', borderRadius: 4, fontSize: 11, color: '#92400e',
            }}>
              <span style={{ fontWeight: 700 }}>IMPORTANTE: </span>
              Al confirmar, quedará registrado digitalmente con fecha, hora y tu identificación.
            </div>
          </div>

          {/* Derecha: botones */}
          <div style={{ padding: '20px 24px' }}>
            {yaConfirmado && remito.recepcion_estado ? (
              /* Ya confirmado */
              <div style={{ textAlign: 'center', paddingTop: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>
                  {remito.recepcion_estado === 'conforme' ? '✅' : remito.recepcion_estado === 'con_observaciones' ? '⚠️' : '❌'}
                </div>
                <div style={{
                  padding: '12px 20px', borderRadius: 10,
                  background: RECEPCION_INFO[remito.recepcion_estado]?.bg ?? '#f9fafb',
                  border: `1px solid ${RECEPCION_INFO[remito.recepcion_estado]?.border ?? '#e5e7eb'}`,
                  color: RECEPCION_INFO[remito.recepcion_estado]?.color ?? '#374151',
                  fontSize: 14, fontWeight: 800, marginBottom: 10,
                }}>
                  {RECEPCION_INFO[remito.recepcion_estado]?.titulo}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Recepción confirmada. Gracias por tu respuesta.
                </div>
                {remito.recepcion_obs && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 12, color: '#374151', textAlign: 'left' }}>
                    <span style={{ fontWeight: 700 }}>Tu observación:</span> {remito.recepcion_obs}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  ¿Recibiste correctamente tu pedido?
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Elegí una opción:</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {Object.entries(RECEPCION_INFO).map(([key, info]) => (
                    <button key={key} type="button" onClick={() => setEstadoSel(key)}
                      style={{
                        padding: '12px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${estadoSel === key ? info.border : '#e5e7eb'}`,
                        background: estadoSel === key ? info.bg : 'white',
                        transition: 'all .15s',
                      }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: info.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 900, color: info.color,
                        margin: '0 auto 8px', border: `2px solid ${info.border}`,
                      }}>
                        {info.icon}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: info.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                        {info.titulo}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.4 }}>
                        {info.subtitulo}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Campo observaciones */}
                {estadoSel === 'con_observaciones' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Describí la observación *
                    </label>
                    <textarea
                      value={obs}
                      onChange={e => setObs(e.target.value)}
                      placeholder="¿Qué detalle notaste? Ej: falta un accesorio, la ventana tiene un rayón..."
                      style={{
                        width: '100%', padding: '8px 10px', fontSize: 12,
                        border: '1px solid #d1d5db', borderRadius: 6, resize: 'vertical', minHeight: 70,
                        fontFamily: 'inherit', color: '#374151', outline: 'none',
                      }}
                    />
                  </div>
                )}
                {estadoSel === 'no_conforme' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Detallá el problema <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>
                    </label>
                    <textarea
                      value={obs}
                      onChange={e => setObs(e.target.value)}
                      placeholder="¿Qué falta o qué problema encontraste?"
                      style={{
                        width: '100%', padding: '8px 10px', fontSize: 12,
                        border: '1px solid #fca5a5', borderRadius: 6, resize: 'vertical', minHeight: 70,
                        fontFamily: 'inherit', color: '#374151', outline: 'none',
                      }}
                    />
                  </div>
                )}

                <button type="button" onClick={confirmar} disabled={!estadoSel || confirmando}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 8, cursor: estadoSel ? 'pointer' : 'not-allowed',
                    background: estadoSel ? NAVY : '#e5e7eb',
                    color: estadoSel ? 'white' : '#9ca3af',
                    fontSize: 13, fontWeight: 700, border: 'none',
                    transition: 'all .15s',
                  }}>
                  {confirmando ? 'Confirmando...' : 'Confirmar recepción'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                  <span>🔒</span>
                  <span>Tu confirmación es segura y quedará registrada en nuestro sistema. Esto nos ayuda a brindarte un mejor servicio y respaldo.</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{
          background: NAVY, padding: '14px 24px',
          display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 28px',
          fontSize: 11, color: '#bfdbfe',
        }}>
          {emp.telefono  && <span>📞 {emp.telefono}</span>}
          {emp.email     && <span>✉ {emp.email}</span>}
          {emp.direccion && <span>📍 {emp.direccion}</span>}
          {emp.instagram && <span>📷 {emp.instagram}</span>}
          {emp.website   && <span>🌐 {emp.website}</span>}
        </div>
      </div>
    </div>
  );
}

const RECEPCION_INFO: Record<string, { icon: string; titulo: string; subtitulo: string; bg: string; border: string; color: string }> = {
  conforme:          { icon: '✓', titulo: 'ESTOY CONFORME',           subtitulo: 'Recibí todo en perfectas condiciones',   bg: '#f0fdf4', border: GREEN,    color: GREEN    },
  con_observaciones: { icon: '!', titulo: 'RECIBÍ CON OBSERVACIONES', subtitulo: 'Hubo algún detalle a tener en cuenta',   bg: '#fffbeb', border: '#d97706', color: '#d97706' },
  no_conforme:       { icon: '✕', titulo: 'NO RECIBÍ CORRECTAMENTE',  subtitulo: 'Faltan productos o hay problemas',       bg: '#fef2f2', border: RED,       color: RED      },
};
