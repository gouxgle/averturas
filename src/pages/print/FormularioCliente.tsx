import { useEffect } from 'react';

const NAVY   = '#1e3a5f';
const GREEN  = '#166534';
const PURPLE = '#7c3aed';
const ORANGE = '#b45309';
const GRAY   = '#666';
const LGRAY  = '#999';
const LINE   = '#ccc';

const css = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { background: #e5e7eb; } .page { margin: 20px auto; } }
  .page { width: 210mm; background: white; }
  .formulario { page-break-inside: avoid; }
  .corte { border-top: 1.5px dashed #aaa; margin: 4mm 0; display: flex; align-items: center; justify-content: center; }
  .corte span { background: white; padding: 0 8px; font-size: 8px; color: #aaa; }
  @media print { .corte { margin: 3mm 0; } }
`;

function Linea({ label, ancho = '100%', inline = false }: { label: string; ancho?: string; inline?: boolean }) {
  return (
    <div style={{ display: inline ? 'inline-block' : 'block', width: ancho, paddingRight: inline ? 10 : 0, marginBottom: 7 }}>
      <div style={{ fontSize: 9, color: '#333', fontWeight: 700, letterSpacing: 0.3, marginBottom: 2 }}>{label}</div>
      <div style={{ borderBottom: `1px solid ${LINE}`, height: 20 }} />
    </div>
  );
}

function Checks({ opciones }: { opciones: (string | { label: string; conLinea?: boolean })[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 4 }}>
      {opciones.map(op => {
        const label = typeof op === 'string' ? op : op.label;
        const conLinea = typeof op === 'object' && op.conLinea;
        return (
          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#333', cursor: 'default' }}>
            <span style={{ display: 'inline-block', width: 11, height: 11, border: '1.3px solid #888', borderRadius: 2, flexShrink: 0 }} />
            {label}
            {conLinea && <span style={{ borderBottom: `1px solid ${LINE}`, width: 90, height: 13, display: 'inline-block' }} />}
          </label>
        );
      })}
    </div>
  );
}

function SecHeader({ num, label, color }: { num: number; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, marginTop: 6, borderBottom: `1.5px solid ${color}`, paddingBottom: 3 }}>
      <span style={{ background: color, color: 'white', fontSize: 8.5, fontWeight: 700, width: 17, height: 17, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: 11.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  );
}

function RenglonesBlanco({ cantidad = 3 }: { cantidad?: number }) {
  return (
    <div>
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} style={{ borderBottom: `1px solid ${LINE}`, height: 20 }} />
      ))}
    </div>
  );
}

function Formulario() {
  return (
    <div className="formulario" style={{ padding: '4mm 4mm' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, paddingBottom: 5, borderBottom: `2.5px solid ${NAVY}` }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: NAVY, letterSpacing: 0.3 }}>FICHA RÁPIDA DEL CLIENTE</div>
          <div style={{ fontSize: 9, color: GRAY, marginTop: 1 }}>Completá con letra imprenta clara</div>
        </div>
        <div style={{ fontSize: 9.5, color: '#333', fontWeight: 600, whiteSpace: 'nowrap' }}>
          FECHA: ____ / ____ / ________
        </div>
      </div>

      {/* ── 1: DATOS DEL CLIENTE ── */}
      <SecHeader num={1} label="Datos del cliente" color={GREEN} />
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="Nombre y apellido" ancho="65%" inline />
        <Linea label="Celular (WhatsApp)" ancho="35%" inline />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="Localidad" ancho="45%" inline />
        <Linea label="Barrio" ancho="55%" inline />
      </div>
      <Linea label="Dirección de la obra (si es distinta)" />

      {/* ── 2: ¿CÓMO NOS CONOCIÓ? ── */}
      <SecHeader num={2} label="¿Cómo nos conoció?" color={NAVY} />
      <Checks opciones={[
        'WhatsApp', 'Facebook', 'Instagram', 'Google', 'Cliente recomendado', 'Pasó por el local',
        { label: 'Otro:', conLinea: true },
      ]} />

      {/* ── 3: ¿QUÉ NECESITA? ── */}
      <SecHeader num={3} label="¿Qué necesita?" color={PURPLE} />
      <Checks opciones={['Ventanas', 'Puertas', 'Puerta Ventana', 'Mamparas', 'Mosquiteros']} />
      <Checks opciones={[
        'Rejas', 'Cerramiento', 'Frente Comercial', 'Reparación',
        { label: 'Otro:', conLinea: true },
      ]} />
      <div style={{ fontSize: 9, color: '#333', fontWeight: 700, letterSpacing: 0.3, marginTop: 3, marginBottom: 2 }}>
        Medidas aproximadas / observaciones
      </div>
      <RenglonesBlanco cantidad={2} />

      {/* ── 4: USO INTERNO — solo renglones para anotar a mano ── */}
      <SecHeader num={4} label="Uso interno" color={ORANGE} />
      <RenglonesBlanco cantidad={3} />
    </div>
  );
}

export function FormularioCliente() {
  useEffect(() => {
    document.title = 'Formulario de Cliente';
    setTimeout(() => window.print(), 400);
  }, []);

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <Formulario />
        <div className="corte"><span>✂ — recortar aquí — ✂</span></div>
        <Formulario />
      </div>
    </>
  );
}
