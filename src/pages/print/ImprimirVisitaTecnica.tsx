import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, X, Ruler } from 'lucide-react';
import { api } from '@/lib/api';
import type { Cliente } from '@/types';

interface VisitaTecnicaItem {
  ambiente: string | null;
  descripcion: string | null;
  ancho_mm: string | number | null;
  alto_mm: string | number | null;
}

interface VisitaTecnicaDetalle {
  id: string;
  numero: string;
  estado: string;
  fecha_visita: string | null;
  tecnico: string | null;
  color: string[];
  vidrio: string[];
  instalacion: string[];
  abertura_especial: string[];
  observaciones: string | null;
  cliente: Cliente;
  items: VisitaTecnicaItem[];
}

const NAVY = '#031d49';
const RED  = '#e31e24';

const css = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { background: #e5e7eb; } .page { margin: 20px auto; } }
  .page { width: 210mm; min-height: 297mm; background: white; }
`;

function SecHeader({ label, color = NAVY }: { label: string; color?: string }) {
  return (
    <div style={{
      display: 'inline-block', background: color, color: 'white',
      fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
      padding: '4px 14px', borderRadius: 6, marginBottom: 8,
    }}>
      {label}
    </div>
  );
}

function Check({ label, checked = false }: { label: string; checked?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#333', marginBottom: 6 }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 12, height: 12, border: '1.3px solid #999', borderRadius: 2, flexShrink: 0,
        background: checked ? NAVY : 'transparent', borderColor: checked ? NAVY : '#999',
      }}>
        {checked && <span style={{ color: 'white', fontSize: 9, lineHeight: 1, fontWeight: 900 }}>✓</span>}
      </span>
      {label}
    </label>
  );
}

function matchOtro(opciones: string[], fijas: string[]): string | null {
  const extra = opciones.find(o => !fijas.includes(o));
  return extra ?? null;
}

function nombreCliente(c: Cliente) {
  return c.tipo_persona === 'juridica'
    ? (c.razon_social ?? '')
    : `${c.apellido ?? ''} ${c.nombre ?? ''}`.trim();
}

export function ImprimirVisitaTecnica() {
  const [searchParams] = useSearchParams();
  const visitaId = searchParams.get('visita_id');
  const [visita, setVisita] = useState<VisitaTecnicaDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Visita Técnica';
    if (!visitaId) { setLoading(false); return; }
    api.get<VisitaTecnicaDetalle>(`/visitas-tecnicas/${visitaId}`)
      .then(setVisita)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visitaId]);

  const cliente = visita?.cliente ?? null;
  const items = visita?.items ?? [];
  const filas = Array.from({ length: 10 }).map((_, i) => items[i] ?? null);
  const fecha = visita?.fecha_visita ? visita.fecha_visita.slice(0, 10).split('-').reverse().join(' / ') : '____ / ____ / ________';

  useEffect(() => {
    if (!loading) setTimeout(() => window.print(), 400);
  }, [loading]);

  return (
    <>
      <style>{css}</style>

      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Visita Técnica</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.close()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#4b5563', background: 'white' }}>
            <X size={14} /> Cerrar
          </button>
          <button onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, color: 'white', background: NAVY, border: 'none' }}>
            <Printer size={14} /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="page" style={{ padding: '10mm 8mm' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="34" height="34" viewBox="0 0 200 200" fill="none">
              <rect x="8"   y="8"   width="84" height="84" rx="12" fill={NAVY} />
              <rect x="108" y="8"   width="84" height="84" rx="12" fill={RED} />
              <rect x="8"   y="108" width="84" height="84" rx="12" fill={NAVY} />
              <rect x="108" y="108" width="84" height="84" rx="12" fill={NAVY} />
            </svg>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, letterSpacing: 0.5 }}>CESAR BRITEZ</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#666', letterSpacing: 2 }}>ABERTURAS &amp; DISEÑO</div>
            </div>
          </div>

          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: NAVY,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Ruler size={26} color="white" />
          </div>

          <div style={{ fontSize: 24, fontWeight: 900, color: NAVY, letterSpacing: 1 }}>VISITA TÉCNICA</div>
        </div>

        {/* ── Datos del cliente ── */}
        <div style={{ border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <SecHeader label="Datos del cliente" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 12, fontSize: 12, color: '#333' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <strong>Cliente:</strong>
              <span style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: 2 }}>{cliente ? nombreCliente(cliente) : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <strong>Fecha de visita:</strong>
              <span style={{ marginLeft: 4 }}>{fecha}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <strong>Teléfono:</strong>
              <span style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: 2 }}>{cliente?.telefono ?? ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <strong>Técnico:</strong>
              <span style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: 2 }}>{visita?.tecnico ?? ' '}</span>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <strong>Dirección:</strong>
              <span style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: 2 }}>{cliente?.direccion ?? ''}</span>
            </div>
          </div>
        </div>

        {/* ── Aberturas a medir ── */}
        <SecHeader label="Aberturas a medir" />
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, border: '1.5px solid #d1d5db' }}>
          <thead>
            <tr style={{ background: NAVY, color: 'white' }}>
              <th style={{ padding: '6px 4px', fontSize: 9, fontWeight: 700, width: 30, textAlign: 'center' }}>N°</th>
              <th style={{ padding: '6px 4px', fontSize: 9, fontWeight: 700, textAlign: 'left' }}>AMBIENTE</th>
              <th style={{ padding: '6px 4px', fontSize: 9, fontWeight: 700, textAlign: 'left' }}>DESCRIPCIÓN</th>
              <th style={{ padding: '6px 4px', fontSize: 9, fontWeight: 700, width: 80, textAlign: 'center' }}>ANCHO (mm)</th>
              <th style={{ padding: '6px 4px', fontSize: 9, fontWeight: 700, width: 80, textAlign: 'center' }}>ALTO (mm)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((it, i) => (
              <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: '7px 4px', fontSize: 10.5, textAlign: 'center', color: '#666' }}>{i + 1}</td>
                <td style={{ padding: '7px 4px', fontSize: 10.5 }}>{it?.ambiente || ' '}</td>
                <td style={{ padding: '7px 4px', fontSize: 10.5 }}>{it?.descripcion || ' '}</td>
                <td style={{ padding: '7px 4px', fontSize: 10.5, textAlign: 'center' }}>{it?.ancho_mm ?? ' '}</td>
                <td style={{ padding: '7px 4px', fontSize: 10.5, textAlign: 'center' }}>{it?.alto_mm ?? ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Detalles importantes ── */}
        <div style={{ border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <SecHeader label="Detalles importantes (marcar)" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', columnGap: 16 }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, marginBottom: 6 }}>COLOR</p>
              <Check label="Blanco" checked={visita?.color.includes('Blanco')}/>
              <Check label="Negro" checked={visita?.color.includes('Negro')}/>
              <Check label="Natural" checked={visita?.color.includes('Natural')}/>
              <Check label={`Otro: ${matchOtro(visita?.color ?? [], ['Blanco','Negro','Natural']) ?? '______'}`} checked={!!matchOtro(visita?.color ?? [], ['Blanco','Negro','Natural'])}/>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, marginBottom: 6 }}>VIDRIO</p>
              <Check label="Transparente" checked={visita?.vidrio.includes('Transparente')}/>
              <Check label="Esmerilado" checked={visita?.vidrio.includes('Esmerilado')}/>
              <Check label="Repartido" checked={visita?.vidrio.includes('Repartido')}/>
              <Check label="DVH" checked={visita?.vidrio.includes('DVH')}/>
              <Check label={`Otro: ${matchOtro(visita?.vidrio ?? [], ['Transparente','Esmerilado','Repartido','DVH']) ?? '______'}`} checked={!!matchOtro(visita?.vidrio ?? [], ['Transparente','Esmerilado','Repartido','DVH'])}/>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, marginBottom: 6 }}>INSTALACIÓN</p>
              <Check label="Con colocación" checked={visita?.instalacion.includes('Con colocación')}/>
              <Check label="Sin colocación" checked={visita?.instalacion.includes('Sin colocación')}/>
              <Check label="Retira en local" checked={visita?.instalacion.includes('Retira en local')}/>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, marginBottom: 6 }}>ABERTURA ESPECIAL</p>
              <Check label="Reja" checked={visita?.abertura_especial.includes('Reja')}/>
              <Check label="Celosía" checked={visita?.abertura_especial.includes('Celosía')}/>
              <Check label="Persiana" checked={visita?.abertura_especial.includes('Persiana')}/>
              <Check label="Mosquitero" checked={visita?.abertura_especial.includes('Mosquitero')}/>
              <Check label={`Otro: ${matchOtro(visita?.abertura_especial ?? [], ['Reja','Celosía','Persiana','Mosquitero']) ?? '______'}`} checked={!!matchOtro(visita?.abertura_especial ?? [], ['Reja','Celosía','Persiana','Mosquitero'])}/>
            </div>
          </div>
        </div>

        {/* ── Croquis general ── */}
        <SecHeader label="Croquis general" />
        <p style={{ fontSize: 9.5, color: '#6b7280', marginTop: -6, marginBottom: 6 }}>Dibujar ubicación de las aberturas y numerarlas</p>
        <div style={{
          border: '1.5px solid #d1d5db', borderRadius: 10, height: 190, marginBottom: 16,
          backgroundImage: 'linear-gradient(to right, #eee 1px, transparent 1px), linear-gradient(to bottom, #eee 1px, transparent 1px)',
          backgroundSize: '10mm 10mm',
        }} />

        {/* ── Observaciones ── */}
        <SecHeader label="Observaciones" />
        {visita?.observaciones ? (
          <p style={{ fontSize: 11, color: '#333', whiteSpace: 'pre-wrap' }}>{visita.observaciones}</p>
        ) : (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ borderBottom: '1px solid #ccc', height: 22 }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
