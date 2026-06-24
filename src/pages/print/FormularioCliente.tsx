import { useEffect } from 'react';

const NAVY  = '#1e3a5f';
const GRAY  = '#666';
const LGRAY = '#999';
const LINE  = '#ccc';

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
    <div style={{ display: inline ? 'inline-block' : 'block', width: ancho, paddingRight: inline ? 8 : 0, marginBottom: 3 }}>
      <div style={{ fontSize: 7.5, color: LGRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>{label}</div>
      <div style={{ borderBottom: `1px solid ${LINE}`, height: 14 }} />
    </div>
  );
}

function Checks({ label, opciones }: { label: string; opciones: string[] }) {
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ fontSize: 7.5, color: LGRAY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        {opciones.map(op => (
          <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8.5, color: '#333', cursor: 'default' }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, border: '1px solid #999', borderRadius: 1, flexShrink: 0 }} />
            {op}
          </label>
        ))}
      </div>
    </div>
  );
}

function SecHeader({ num, label, color = NAVY }: { num: number; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, marginTop: 5, borderBottom: `1.5px solid ${color}`, paddingBottom: 2 }}>
      <span style={{ background: color, color: 'white', fontSize: 7, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</span>
      <span style={{ fontSize: 8.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

function Formulario() {
  return (
    <div className="formulario" style={{ padding: '4mm 3mm' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, paddingBottom: 4, borderBottom: `2px solid ${NAVY}` }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: NAVY, letterSpacing: 0.5 }}>FICHA DE CLIENTE</div>
          <div style={{ fontSize: 8, color: GRAY }}>Complete con letra imprenta clara — un carácter por casillero</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 7.5, color: LGRAY }}>Fecha: ____/____/________</div>
          <div style={{ fontSize: 7.5, color: LGRAY, marginTop: 2 }}>Atendido por: _____________</div>
        </div>
      </div>

      {/* ── SECCIÓN 1: DATOS BÁSICOS ── */}
      <SecHeader num={1} label="Datos básicos" color="#166534" />
      <Checks
        label="Tipo de persona"
        opciones={['Persona física', 'Empresa / Jurídica']}
      />
      <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
        <Linea label="Apellido y nombre  /  Razón social" ancho="65%" inline />
        <Linea label="WhatsApp / Celular (prefijo — número)" ancho="35%" inline />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="Localidad" ancho="40%" inline />
        <div style={{ width: '60%' }}>
          <Checks label="Tipo de cliente" opciones={['Cliente', 'Potencial', 'Contacto', 'Proveedor']} />
        </div>
      </div>
      <Checks
        label="Origen del contacto"
        opciones={['Consulta en tienda', 'WhatsApp', 'Referido', 'Redes sociales', 'Otro: ____________']}
      />
      <Linea label="Notas / observaciones iniciales" />

      {/* ── SECCIÓN 2: DATOS PERSONALES ── */}
      <SecHeader num={2} label="Datos personales" color="#1e3a5f" />
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="DNI / CUIT" ancho="30%" inline />
        <Linea label="Email" ancho="45%" inline />
        <Linea label="Fecha de nacimiento" ancho="25%" inline />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Checks label="Género" opciones={['Masc.', 'Fem.', 'Otro']} />
        <Checks label="Estado civil" opciones={['Soltero/a', 'Casado/a', 'Divorciado/a', 'Otro']} />
        <Checks label="¿Acepta contacto comercial?" opciones={['Sí', 'No']} />
      </div>

      {/* ── SECCIÓN 3: DOMICILIOS ── */}
      <SecHeader num={3} label="Domicilios" color="#7c3aed" />
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="Domicilio principal" ancho="75%" inline />
        <Linea label="Cód. postal" ancho="25%" inline />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="Domicilio de obra (si difiere)" ancho="65%" inline />
        <Linea label="Localidad obra" ancho="35%" inline />
      </div>

      {/* ── SECCIÓN 4: CONTACTO ADICIONAL ── */}
      <SecHeader num={4} label="Contacto adicional" color="#0369a1" />
      <div style={{ display: 'flex', gap: 4 }}>
        <Linea label="Teléfono fijo" ancho="30%" inline />
        <Linea label="Email alternativo" ancho="45%" inline />
        <div style={{ width: '25%' }}>
          <Checks label="Preferencia" opciones={['WhatsApp', 'Llamada', 'Email']} />
        </div>
      </div>

      {/* ── SECCIÓN 5: CLASIFICACIÓN ── */}
      <SecHeader num={5} label="Clasificación / CRM" color="#b45309" />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Checks label="Condición IVA" opciones={['Cons. Final', 'Resp. Insc.', 'Monotrib.', 'Exento']} />
        <div style={{ flex: 1 }}>
          <Linea label="Interés / producto consultado" />
        </div>
      </div>

      {/* Firma */}
      <div style={{ display: 'flex', gap: 12, marginTop: 5, paddingTop: 4, borderTop: `1px solid ${LINE}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ borderBottom: `1px solid ${LINE}`, height: 16 }} />
          <div style={{ fontSize: 7.5, color: LGRAY, textAlign: 'center', marginTop: 2 }}>Firma del cliente (opcional)</div>
        </div>
        <div style={{ width: 100 }}>
          <div style={{ borderBottom: `1px solid ${LINE}`, height: 16 }} />
          <div style={{ fontSize: 7.5, color: LGRAY, textAlign: 'center', marginTop: 2 }}>Aclaración</div>
        </div>
      </div>
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
