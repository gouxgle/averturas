import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Upload, X, ImageIcon, Package, Tag,
  Ruler, DollarSign, FileText, Boxes, DoorOpen, AppWindow, Check
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TipoOperacion, TipoAbertura, Sistema, Proveedor } from '@/types';

// ── Tipos ─────────────────────────────────────────────────────
type Atributos = Record<string, unknown>;

// ── Constantes puertas ────────────────────────────────────────
const TIPO_PUERTA = [
  { v: 'aluminio',        l: 'Aluminio' },
  { v: 'placa',           l: 'Placa' },
  { v: 'chapa_simple',    l: 'Chapa simple' },
  { v: 'chapa_inyectada', l: 'Chapa inyectada' },
  { v: 'plegable_pvc',    l: 'Plegable PVC' },
  { v: 'granero',         l: 'Granero' },
  { v: 'corrediza_oculta',l: 'Corrediza oculta' },
  { v: 'embutir',         l: 'Embutir' },
];

const USO_PUERTA = [
  { v: 'interior',       l: 'Interior' },
  { v: 'exterior',       l: 'Exterior' },
  { v: 'ingreso_frente', l: 'Ingreso / Frente' },
];

const CONFIG_HOJAS = [
  { v: 'hoja_simple',      l: 'Hoja simple', sub: '1 hoja' },
  { v: 'hoja_y_media',     l: 'Hoja y media', sub: '1½' },
  { v: 'dos_hojas',        l: '2 hojas iguales', sub: '2H' },
  { v: 'puerta_pano_fijo', l: 'Puerta + paño fijo', sub: '+paño' },
];

const ANCHOS_HOJA: Record<string, number[]> = {
  hoja_simple:      [80, 85, 90],
  hoja_y_media:     [80, 85, 90],
  dos_hojas:        [80, 90],
  puerta_pano_fijo: [80, 85, 90],
};

const TIPO_PROVISION = [
  { v: 'hoja_sola',   l: 'Hoja sola' },
  { v: 'hoja_marco',  l: 'Hoja + marco' },
  { v: 'kit_completo',l: 'Kit completo' },
];

const ESTRUCTURA = [
  { v: 'aluminio_completo',      l: 'Aluminio completo' },
  { v: 'placa_marco_chapa',      l: 'Placa + marco chapa' },
  { v: 'placa_marco_aluminio',   l: 'Placa + marco aluminio' },
  { v: 'chapa_simple',           l: 'Chapa simple' },
  { v: 'chapa_inyectada',        l: 'Chapa inyectada' },
  { v: 'pvc',                    l: 'PVC' },
  { v: 'mdf',                    l: 'MDF' },
  { v: 'madera',                 l: 'Madera' },
];

const LINEA_ALUM = [
  { v: 'herrero', l: 'Herrero' },
  { v: 'modena',  l: 'Módena' },
  { v: 'a30',     l: 'A30' },
];

const ESPESOR = ['25 mm', '36 mm'];

const MODELO: Record<string, string[]> = {
  aluminio:        ['Ciega', 'Vidriada', '½ vidrio', '¼ vidrio', 'Con apliques'],
  placa:           ['Lisa', 'Diseño'],
  chapa_simple:    ['Ciega', 'Con ventilación'],
  chapa_inyectada: ['Ciega', 'Con ventilación'],
  granero:         ['Lisa', 'Diseño'],
};

const MODELO_COMERCIAL = ['Pino', 'Cedrillo', 'Camden', 'Craftmaster', 'Otro'];

const APERTURA = [
  { v: 'de_abrir',  l: 'De abrir' },
  { v: 'corrediza', l: 'Corrediza' },
  { v: 'plegable',  l: 'Plegable' },
  { v: 'embutir',   l: 'Embutir' },
];

const HERRAJES = [
  { v: 'picaporte',              l: 'Picaporte' },
  { v: 'barral_medio_picaporte', l: 'Barral ext. + ½ picaporte' },
  { v: 'corredizo_oculto',       l: 'Corredizo oculto (guía c/tapa)' },
  { v: 'corredizo_expuesto',     l: 'Corredizo expuesto (granero)' },
  { v: 'sistema_plegable',       l: 'Sistema plegable' },
];

const COMPONENTES = [
  { v: 'herrajes_completos', l: 'Herrajes completos' },
  { v: 'burleteria_felpa',   l: 'Burletería / felpa' },
  { v: 'sellado',            l: 'Sellado' },
  { v: 'embalado',           l: 'Embalado' },
];

const COLORES_PUERTA: Record<string, string[]> = {
  aluminio:         ['Blanco', 'Negro', 'Natural'],
  placa:            ['Blanco', 'Cedro', 'Nogal', 'Roble', 'Gris', 'Tabaco', 'Wengue'],
  chapa_simple:     ['Blanco', 'Negro', 'Gris', 'Beige', 'Marrón'],
  chapa_inyectada:  ['Blanco', 'Negro', 'Gris', 'Beige', 'Marrón'],
  plegable_pvc:     ['Blanco', 'Marrón'],
  granero:          ['Blanco', 'Cedro', 'Nogal', 'Roble', 'Gris', 'Tabaco', 'Wengue'],
  corrediza_oculta: ['Blanco', 'Negro', 'Natural'],
  embutir:          ['Blanco', 'Negro', 'Natural'],
};

const VIDRIO_TIPO  = ['Transparente', 'Laminado', 'Doble vidrio (DVH)'];
const VIDRIO_FMT   = ['Entero', '½ vidrio', '¼ vidrio'];
const DISEÑO_HOJA  = ['Lisa', 'Repartida'];
const CFG_ESTRUC   = ['Simple', 'Con lateral fijo'];

// ── Constantes ventanas ──────────────────────────────────────
const TIPO_VENTANA = [
  { v: 'corrediza',   l: 'Corrediza' },
  { v: 'con_celosia', l: 'Con celosía' },
  { v: 'de_abrir',    l: 'De abrir' },
  { v: 'banderola',   l: 'Banderola' },
  { v: 'ventiluz',    l: 'Ventiluz' },
  { v: 'aireador',    l: 'Aireador' },
];

const VENTANA_CON_HOJAS = new Set(['corrediza', 'de_abrir']);

const HOJAS_VENTANA = [
  { v: '2_hojas', l: '2 hojas' },
  { v: '3_hojas', l: '3 hojas' },
  { v: '4_hojas', l: '4 hojas' },
];

const CFG_ESPECIAL_VENTANA = [
  { v: 'simple',              l: 'Simple' },
  { v: 'con_reja',            l: 'Con reja' },
  { v: 'con_mosquitero',      l: 'Con mosquitero' },
  { v: 'con_reja_mosquitero', l: 'Con reja y mosquitero' },
];

const CELOSIA_APERTURA = [
  { v: 'no',        l: 'Sin celosía' },
  { v: 'corrediza', l: 'Corrediza' },
  { v: 'de_abrir',  l: 'De abrir' },
];

const VIDRIO_TIPO_VNT  = ['Transparente', 'Laminado', 'Doble vidrio'];

const DISEÑO_VNT = [
  { v: 'entero',    l: 'Entero' },
  { v: 'repartido', l: 'Repartido / con divisoria' },
];

const LINEA_VNT = [
  { v: 'herrero', l: 'Herrero' },
  { v: 'modena',  l: 'Módena' },
  { v: 'a30',     l: 'A30' },
];

const COLORES_VENTANA = ['Blanco', 'Negro', 'Anodizado Natural'];

const COMPONENTES_VNT = [
  { v: 'herrajes_completos', l: 'Herrajes completos' },
  { v: 'felpa_burletes',     l: 'Felpa / burletes' },
  { v: 'desagues_marco',     l: 'Desagüe en marco' },
  { v: 'sellado',            l: 'Sellado' },
  { v: 'embalado',           l: 'Embalado' },
];

// ── Helpers ───────────────────────────────────────────────────
const CATEGORIAS: { value: TipoOperacion; label: string; desc: string }[] = [
  { value: 'estandar',           label: 'Estándar',               desc: 'Medida de stock, dimensiones fijas' },
  { value: 'a_medida_proveedor', label: 'A medida / Fabricación', desc: 'Producto a pedido — proveedor o taller propio' },
];

function calcAncho(config: string, anchHoja: number): number {
  if (config === 'dos_hojas')        return anchHoja * 2;
  if (config === 'hoja_y_media')     return anchHoja + anchHoja / 2;
  if (config === 'puerta_pano_fijo') return anchHoja + 30;
  return anchHoja;
}

// Componente botones mutualmente excluyentes
function BtnGroup({ options, value, onChange, cols = 3, small = false }: {
  options: { v: string; l: string; sub?: string }[];
  value: string;
  onChange: (v: string) => void;
  cols?: number;
  small?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 grid-cols-${cols}`}>
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cn(
            'px-2 py-2 rounded-lg border text-left transition-all',
            small ? 'text-xs' : 'text-sm',
            value === o.v
              ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold'
              : 'border-gray-200 text-gray-600 hover:border-sky-300 hover:bg-sky-50/50'
          )}>
          <span className="block leading-tight">{o.l}</span>
          {o.sub && <span className="block text-[10px] opacity-60 mt-0.5">{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function BtnCheck({ options, values, onChange }: {
  options: { v: string; l: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => toggle(o.v)}
          className={cn(
            'px-2.5 py-1.5 rounded-lg border text-xs transition-all',
            values.includes(o.v)
              ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold'
              : 'border-gray-200 text-gray-600 hover:border-sky-300'
          )}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ── FieldCard: tarjeta por atributo con indicador de completado ──
function FieldCard({ title, complete, optional = false, children }: {
  title: string;
  complete: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-150',
      complete ? 'border-emerald-300' : 'border-gray-200'
    )}>
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b',
        complete ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'
      )}>
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          complete ? 'text-emerald-700' : 'text-gray-400'
        )}>
          {title}
          {optional && <span className="normal-case font-normal ml-1 opacity-60">(opc.)</span>}
        </span>
        {complete && <Check size={10} className="text-emerald-500 shrink-0" />}
      </div>
      <div className="p-3 bg-white">
        {children}
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ── Sección puertas ───────────────────────────────────────────
function PuertaAtributos({ atributos, setAttr, onAnchoChange, onColorChange, colorActual }: {
  atributos: Atributos;
  setAttr: (k: string, v: unknown) => void;
  onAnchoChange: (v: number | null) => void;
  onColorChange: (c: string) => void;
  colorActual: string;
}) {
  const tp          = atributos.tipo_puerta as string ?? '';
  const cfg         = atributos.config_hojas as string ?? '';
  const anchHoja    = atributos.ancho_hoja as number ?? 0;
  const linea       = atributos.linea as string ?? '';
  const vidIncluye  = atributos.vidrio_incluye;
  const componentes = atributos.componentes as string[] ?? [];
  const tieneModelos = Boolean(MODELO[tp]);
  const coloresDsp   = COLORES_PUERTA[tp] ?? [];

  // Progreso: campos requeridos completados
  const progressFields = [
    tp !== '',
    Boolean(atributos.uso),
    cfg !== '',
    anchHoja > 0,
    Boolean(atributos.hoja_principal),
    Boolean(atributos.tipo_provision),
    Boolean(atributos.estructura),
    tp !== 'aluminio' || linea !== '',
    !MODELO[tp] || Boolean(atributos.modelo),
    Boolean(atributos.apertura),
    atributos.vidrio_incluye !== undefined,
    Boolean(atributos.herrajes),
    atributos.cerradura !== undefined,
    colorActual !== '',
    Boolean(atributos.instalacion),
  ];
  const completed = progressFields.filter(Boolean).length;
  const total     = progressFields.length;
  const pct       = Math.round(completed / total * 100);

  function handleAnchoHoja(v: number) {
    setAttr('ancho_hoja', v);
    if (cfg) onAnchoChange(calcAncho(cfg, v));
  }
  function handleConfig(v: string) {
    setAttr('config_hojas', v);
    if (anchHoja) onAnchoChange(calcAncho(v, anchHoja));
  }
  function handleTipoPuerta(v: string) {
    setAttr('tipo_puerta', v);
    setAttr('linea', '');
    setAttr('espesor', '');
    setAttr('modelo', '');
    setAttr('modelo_comercial', '');
    setAttr('subtipo_granero', '');
    setAttr('componentes', ['herrajes_completos']);
    onColorChange('');
  }

  const btn = (active: boolean) => cn(
    'px-2 py-2 rounded-lg border text-xs text-left leading-tight transition-all',
    active ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-sky-300'
  );

  return (
    <div className="space-y-3">

      {/* Barra de progreso — sticky */}
      <div className="sticky top-2 z-10 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <DoorOpen size={13} className="text-sky-500" />
            Atributos de puerta
          </span>
          <span className={cn('text-xs font-bold tabular-nums flex items-center gap-1', pct === 100 ? 'text-emerald-600' : 'text-gray-400')}>
            {completed}/{total}
            {pct === 100 && <Check size={11} className="text-emerald-500" />}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={cn('h-1.5 rounded-full transition-all duration-300',
              pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-sky-400' : pct >= 30 ? 'bg-amber-400' : 'bg-gray-300'
            )}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>

      {/* ── Identificación ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <FieldCard title="Tipo de puerta" complete={tp !== ''}>
            <div className="grid grid-cols-4 gap-1.5">
              {TIPO_PUERTA.map(o => (
                <button key={o.v} type="button" onClick={() => handleTipoPuerta(o.v)} className={btn(tp === o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
          </FieldCard>
        </div>
        <FieldCard title="Uso" complete={Boolean(atributos.uso)}>
          <div className="flex flex-col gap-1.5">
            {USO_PUERTA.map(o => (
              <button key={o.v} type="button" onClick={() => setAttr('uso', o.v)} className={btn(atributos.uso === o.v)}>
                {o.l}
              </button>
            ))}
          </div>
        </FieldCard>
      </div>

      {/* ── Configuración de hojas ── */}
      {tp && (
        <>
          <SectionDivider label="Configuración de hojas" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldCard title="Tipo de configuración" complete={cfg !== ''}>
              <div className="grid grid-cols-2 gap-1.5">
                {CONFIG_HOJAS.map(o => (
                  <button key={o.v} type="button" onClick={() => handleConfig(o.v)} className={btn(cfg === o.v)}>
                    <span className="block">{o.l}</span>
                    <span className="block text-[10px] opacity-50 mt-0.5">{o.sub}</span>
                  </button>
                ))}
              </div>
            </FieldCard>

            <FieldCard
              title={cfg === 'puerta_pano_fijo' ? 'Ancho puerta' : cfg === 'dos_hojas' ? 'Ancho por hoja' : 'Ancho de hoja'}
              complete={anchHoja > 0}
            >
              {cfg ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    {(ANCHOS_HOJA[cfg] ?? []).map(a => (
                      <button key={a} type="button" onClick={() => handleAnchoHoja(a)}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-sm font-mono text-center transition-all',
                          anchHoja === a ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold' : 'border-gray-200 text-gray-600 hover:border-sky-300'
                        )}>
                        {a} cm
                      </button>
                    ))}
                  </div>
                  {cfg === 'puerta_pano_fijo' && <p className="text-[10px] text-gray-400 mt-2">+ paño fijo: <strong>30 cm</strong></p>}
                  {anchHoja > 0 && <p className="text-[10px] text-sky-600 font-semibold mt-1.5">Total: {calcAncho(cfg, anchHoja)} cm</p>}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Seleccioná configuración primero</p>
              )}
            </FieldCard>

            <FieldCard title="Hoja principal" complete={Boolean(atributos.hoja_principal)}>
              <div className="flex flex-col gap-1.5">
                {[{ v: 'izquierda', l: '← Izquierda' }, { v: 'derecha', l: 'Derecha →' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('hoja_principal', o.v)} className={btn(atributos.hoja_principal === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
          </div>
        </>
      )}

      {/* ── Construcción ── */}
      {tp && (
        <>
          <SectionDivider label="Construcción" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldCard title="Tipo de provisión" complete={Boolean(atributos.tipo_provision)}>
              <div className="flex flex-col gap-1.5">
                {TIPO_PROVISION.map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('tipo_provision', o.v)} className={btn(atributos.tipo_provision === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Estructura" complete={Boolean(atributos.estructura)}>
              <div className="grid grid-cols-2 gap-1.5">
                {ESTRUCTURA.map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('estructura', o.v)} className={btn(atributos.estructura === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
          </div>

          {tp === 'aluminio' && (
            <div className={cn('grid gap-3', linea === 'herrero' ? 'sm:grid-cols-2' : 'grid-cols-1')}>
              <FieldCard title="Línea (aluminio)" complete={linea !== ''}>
                <div className="flex gap-1.5">
                  {LINEA_ALUM.map(o => (
                    <button key={o.v} type="button" onClick={() => { setAttr('linea', o.v); setAttr('espesor', ''); }}
                      className={cn('flex-1 px-2 py-2 rounded-lg border text-xs text-center transition-all',
                        linea === o.v ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </FieldCard>
              {linea === 'herrero' && (
                <FieldCard title="Espesor (Herrero)" complete={Boolean(atributos.espesor)}>
                  <div className="flex gap-2">
                    {ESPESOR.map(e => (
                      <button key={e} type="button" onClick={() => setAttr('espesor', e)}
                        className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                          atributos.espesor === e ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                        {e}
                      </button>
                    ))}
                  </div>
                </FieldCard>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Modelo y apertura ── */}
      {tp && (
        <>
          <SectionDivider label="Modelo y apertura" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tieneModelos && (
              <FieldCard title="Modelo" complete={Boolean(atributos.modelo)}>
                <div className="flex flex-wrap gap-1.5">
                  {(MODELO[tp] ?? []).map(m => (
                    <button key={m} type="button" onClick={() => setAttr('modelo', m)}
                      className={cn('px-3 py-1.5 rounded-lg border text-xs transition-all',
                        atributos.modelo === m ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                      {m}
                    </button>
                  ))}
                </div>
              </FieldCard>
            )}
            {tp === 'placa' && (
              <FieldCard title="Modelo comercial" complete={Boolean(atributos.modelo_comercial)} optional>
                <div className="flex flex-wrap gap-1.5">
                  {MODELO_COMERCIAL.map(m => (
                    <button key={m} type="button" onClick={() => setAttr('modelo_comercial', m)}
                      className={cn('px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                        atributos.modelo_comercial === m ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                      {m}
                    </button>
                  ))}
                </div>
              </FieldCard>
            )}
            {tp === 'granero' && (
              <FieldCard title="Subtipo granero" complete={Boolean(atributos.subtipo_granero)}>
                <div className="flex gap-2">
                  {[{ v: 'mdf', l: 'MDF' }, { v: 'aluminio', l: 'Aluminio' }].map(o => (
                    <button key={o.v} type="button" onClick={() => setAttr('subtipo_granero', o.v)}
                      className={cn('flex-1 py-2 rounded-lg border text-sm font-medium text-center transition-all',
                        atributos.subtipo_granero === o.v ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </FieldCard>
            )}
            <FieldCard title="Diseño de hoja" complete={Boolean(atributos.diseno_hoja)} optional>
              <div className="flex gap-1.5">
                {DISEÑO_HOJA.map(d => (
                  <button key={d} type="button" onClick={() => setAttr('diseno_hoja', d)}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                      atributos.diseno_hoja === d ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                    {d}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Config. estructural" complete={Boolean(atributos.config_estructural)} optional>
              <div className="flex flex-col gap-1.5">
                {CFG_ESTRUC.map(c => (
                  <button key={c} type="button" onClick={() => setAttr('config_estructural', c)}
                    className={cn('py-2 rounded-lg border text-xs font-medium transition-all',
                      atributos.config_estructural === c ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                    {c}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Apertura" complete={Boolean(atributos.apertura)}>
              <div className="grid grid-cols-2 gap-1.5">
                {APERTURA.map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('apertura', o.v)} className={btn(atributos.apertura === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
          </div>
        </>
      )}

      {/* ── Vidrio ── */}
      {tp && (
        <>
          <SectionDivider label="Vidrio" />
          <div className={cn('grid gap-3', vidIncluye === true ? 'sm:grid-cols-3' : 'grid-cols-1')}>
            <FieldCard title="¿Incluye vidrio?" complete={atributos.vidrio_incluye !== undefined}>
              <div className="flex gap-2">
                {[{ v: true, l: 'Con vidrio' }, { v: false, l: 'Sin vidrio' }].map(o => (
                  <button key={String(o.v)} type="button" onClick={() => setAttr('vidrio_incluye', o.v)}
                    className={cn('flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all',
                      vidIncluye === o.v ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
            {vidIncluye === true && (
              <>
                <FieldCard title="Tipo de vidrio" complete={Boolean(atributos.vidrio_tipo)}>
                  <div className="flex flex-col gap-1.5">
                    {VIDRIO_TIPO.map(v => (
                      <button key={v} type="button" onClick={() => setAttr('vidrio_tipo', v)} className={btn(atributos.vidrio_tipo === v)}>
                        {v}
                      </button>
                    ))}
                  </div>
                </FieldCard>
                <FieldCard title="Formato" complete={Boolean(atributos.vidrio_formato)}>
                  <div className="flex flex-col gap-1.5">
                    {VIDRIO_FMT.map(v => (
                      <button key={v} type="button" onClick={() => setAttr('vidrio_formato', v)} className={btn(atributos.vidrio_formato === v)}>
                        {v}
                      </button>
                    ))}
                  </div>
                </FieldCard>
              </>
            )}
          </div>
        </>
      )}

      {/* ── Herrajes y accesorios ── */}
      {tp && (
        <>
          <SectionDivider label="Herrajes y accesorios" />
          <FieldCard title="Tipo de herrajes" complete={Boolean(atributos.herrajes)}>
            <div className="flex flex-col gap-1.5">
              {HERRAJES.map(h => (
                <button key={h.v} type="button" onClick={() => setAttr('herrajes', h.v)} className={btn(atributos.herrajes === h.v)}>
                  {h.l}
                </button>
              ))}
            </div>
          </FieldCard>
          <div className="grid grid-cols-2 gap-3">
            <FieldCard title="Cerradura" complete={atributos.cerradura !== undefined}>
              <div className="flex gap-2">
                {[{ v: true, l: 'Con cerradura' }, { v: false, l: 'Sin cerradura' }].map(o => (
                  <button key={String(o.v)} type="button" onClick={() => setAttr('cerradura', o.v)}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                      atributos.cerradura === o.v ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Componentes incluidos" complete={componentes.length > 0} optional>
              <BtnCheck options={COMPONENTES} values={componentes} onChange={v => setAttr('componentes', v)} />
            </FieldCard>
          </div>
        </>
      )}

      {/* ── Color ── */}
      {tp && coloresDsp.length > 0 && (
        <>
          <SectionDivider label="Color" />
          <FieldCard title="Color" complete={colorActual !== ''}>
            <div className="flex flex-wrap gap-2">
              {coloresDsp.map(c => (
                <button key={c} type="button" onClick={() => onColorChange(c)}
                  className={cn('px-3 py-1.5 rounded-lg border text-sm transition-all',
                    colorActual === c ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                  {c}
                </button>
              ))}
            </div>
          </FieldCard>
        </>
      )}

      {/* ── Comercial ── */}
      {tp && (
        <>
          <SectionDivider label="Comercial" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldCard title="Instalación" complete={Boolean(atributos.instalacion)}>
              <BtnGroup
                options={[{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }, { v: 'opcional', l: 'Opcional' }]}
                value={atributos.instalacion as string ?? ''}
                onChange={v => setAttr('instalacion', v)}
                cols={3} small
              />
            </FieldCard>
            <FieldCard title="Entrega" complete={(atributos.entrega as string[] ?? []).length > 0} optional>
              <BtnCheck
                options={[{ v: 'retiro_local', l: 'Retiro en local' }, { v: 'envio_disponible', l: 'Envío disponible' }]}
                values={atributos.entrega as string[] ?? []}
                onChange={v => setAttr('entrega', v)}
              />
            </FieldCard>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sección ventanas ─────────────────────────────────────────
function VentanaAtributos({ atributos, setAttr, onColorChange, colorActual }: {
  atributos: Atributos;
  setAttr: (k: string, v: unknown) => void;
  onColorChange: (c: string) => void;
  colorActual: string;
}) {
  const tv          = atributos.tipo_ventana as string ?? '';
  const tieneHojas  = VENTANA_CON_HOJAS.has(tv);
  const esCelosia   = tv === 'con_celosia';
  const componentes = atributos.componentes as string[] ?? [];

  // Progreso: campos requeridos según tipo
  const base: boolean[] = [
    tv !== '',
    Boolean(atributos.configuracion_especial),
    Boolean(atributos.vidrio_tipo),
    Boolean(atributos.diseno),
    Boolean(atributos.linea),
    colorActual !== '',
    atributos.mosquitero !== undefined,
    atributos.reja !== undefined,
    Boolean(atributos.instalacion),
  ];
  const conditional: boolean[] = [];
  if (tieneHojas) conditional.push(Boolean(atributos.config_hojas));
  if (esCelosia)  conditional.push(Boolean(atributos.celosia_tipo));
  const all = [...base, ...conditional];
  const completed = all.filter(Boolean).length;
  const total     = all.length;
  const pct       = Math.round(completed / total * 100);

  function handleTipoVentana(v: string) {
    setAttr('tipo_ventana', v);
    setAttr('config_hojas', '');
    setAttr('celosia_tipo', '');
    setAttr('componentes', ['herrajes_completos']);
    onColorChange('');
  }

  const btn = (active: boolean) => cn(
    'px-2 py-2 rounded-lg border text-xs text-left leading-tight transition-all',
    active ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold' : 'border-gray-200 text-gray-600 hover:border-sky-300'
  );

  return (
    <div className="space-y-3">

      {/* Barra de progreso — sticky */}
      <div className="sticky top-2 z-10 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <AppWindow size={13} className="text-sky-500" />
            Atributos de ventana
          </span>
          <span className={cn('text-xs font-bold tabular-nums flex items-center gap-1', pct === 100 ? 'text-emerald-600' : 'text-gray-400')}>
            {completed}/{total}
            {pct === 100 && <Check size={11} className="text-emerald-500" />}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={cn('h-1.5 rounded-full transition-all duration-300',
              pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-sky-400' : pct >= 30 ? 'bg-amber-400' : 'bg-gray-300'
            )}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>

      {/* ── Tipo de ventana ── */}
      <FieldCard title="Tipo de ventana" complete={tv !== ''}>
        <div className="grid grid-cols-3 gap-1.5">
          {TIPO_VENTANA.map(o => (
            <button key={o.v} type="button" onClick={() => handleTipoVentana(o.v)} className={btn(tv === o.v)}>
              {o.l}
            </button>
          ))}
        </div>
      </FieldCard>

      {/* ── Configuración de hojas (corrediza / de abrir) ── */}
      {tv && tieneHojas && (
        <>
          <SectionDivider label="Configuración de hojas" />
          <FieldCard title="Cantidad de hojas" complete={Boolean(atributos.config_hojas)}>
            <div className="flex gap-2">
              {HOJAS_VENTANA.map(o => (
                <button key={o.v} type="button" onClick={() => setAttr('config_hojas', o.v)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium text-center transition-all',
                    atributos.config_hojas === o.v ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                  {o.l}
                </button>
              ))}
            </div>
          </FieldCard>
        </>
      )}

      {/* ── Celosía (solo con_celosia) ── */}
      {tv && esCelosia && (
        <>
          <SectionDivider label="Celosía" />
          <FieldCard title="Tipo de celosía" complete={Boolean(atributos.celosia_tipo)}>
            <div className="flex gap-2">
              {CELOSIA_APERTURA.map(o => (
                <button key={o.v} type="button" onClick={() => setAttr('celosia_tipo', o.v)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium text-center transition-all',
                    atributos.celosia_tipo === o.v ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                  {o.l}
                </button>
              ))}
            </div>
          </FieldCard>
        </>
      )}

      {/* ── Configuración especial ── */}
      {tv && (
        <>
          <SectionDivider label="Configuración" />
          <FieldCard title="Configuración especial" complete={Boolean(atributos.configuracion_especial)}>
            <div className="grid grid-cols-2 gap-1.5">
              {CFG_ESPECIAL_VENTANA.map(o => (
                <button key={o.v} type="button" onClick={() => setAttr('configuracion_especial', o.v)} className={btn(atributos.configuracion_especial === o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
          </FieldCard>
        </>
      )}

      {/* ── Vidrio y diseño ── */}
      {tv && (
        <>
          <SectionDivider label="Vidrio" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldCard title="Tipo de vidrio" complete={Boolean(atributos.vidrio_tipo)}>
              {esCelosia && (
                <p className="text-[10px] text-sky-600 font-semibold mb-2">Ventana con celosía: vidrio corredizo</p>
              )}
              <div className="flex flex-col gap-1.5">
                {VIDRIO_TIPO_VNT.map(v => (
                  <button key={v} type="button" onClick={() => setAttr('vidrio_tipo', v)} className={btn(atributos.vidrio_tipo === v)}>
                    {v}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Diseño" complete={Boolean(atributos.diseno)}>
              <div className="flex flex-col gap-1.5">
                {DISEÑO_VNT.map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('diseno', o.v)} className={btn(atributos.diseno === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
          </div>
        </>
      )}

      {/* ── Línea y color ── */}
      {tv && (
        <>
          <SectionDivider label="Línea y color" />
          <div className="grid grid-cols-2 gap-3">
            <FieldCard title="Línea" complete={Boolean(atributos.linea)}>
              <div className="flex flex-col gap-1.5">
                {LINEA_VNT.map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('linea', o.v)} className={btn(atributos.linea === o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Color" complete={colorActual !== ''}>
              <div className="flex flex-col gap-1.5">
                {COLORES_VENTANA.map(c => (
                  <button key={c} type="button" onClick={() => onColorChange(c)} className={btn(colorActual === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </FieldCard>
          </div>
        </>
      )}

      {/* ── Accesorios ── */}
      {tv && (
        <>
          <SectionDivider label="Accesorios y componentes" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldCard title="Mosquitero" complete={atributos.mosquitero !== undefined}>
              <div className="flex gap-2">
                {[{ v: 'no', l: 'No' }, { v: 'opcional', l: 'Opcional' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('mosquitero', o.v)}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium text-center transition-all',
                      atributos.mosquitero === o.v ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Reja" complete={atributos.reja !== undefined}>
              <div className="flex gap-2">
                {[{ v: 'no', l: 'No' }, { v: 'opcional', l: 'Opcional' }].map(o => (
                  <button key={o.v} type="button" onClick={() => setAttr('reja', o.v)}
                    className={cn('flex-1 py-2 rounded-lg border text-xs font-medium text-center transition-all',
                      atributos.reja === o.v ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold' : 'border-gray-200 text-gray-600 hover:border-sky-300')}>
                    {o.l}
                  </button>
                ))}
              </div>
            </FieldCard>
            <FieldCard title="Componentes incluidos" complete={componentes.length > 0} optional>
              <BtnCheck options={COMPONENTES_VNT} values={componentes} onChange={v => setAttr('componentes', v)} />
            </FieldCard>
          </div>
        </>
      )}

      {/* ── Comercial ── */}
      {tv && (
        <>
          <SectionDivider label="Comercial" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FieldCard title="Stock" complete={Boolean(atributos.stock_tipo)} optional>
              <BtnGroup
                options={[{ v: 'disponible', l: 'Disponible' }, { v: 'por_pedido', l: 'Por pedido' }]}
                value={atributos.stock_tipo as string ?? ''}
                onChange={v => setAttr('stock_tipo', v)}
                cols={2} small
              />
            </FieldCard>
            <FieldCard title="Instalación" complete={Boolean(atributos.instalacion)}>
              <BtnGroup
                options={[{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }, { v: 'opcional', l: 'Opcional' }]}
                value={atributos.instalacion as string ?? ''}
                onChange={v => setAttr('instalacion', v)}
                cols={3} small
              />
            </FieldCard>
            <FieldCard title="Entrega" complete={(atributos.entrega as string[] ?? []).length > 0} optional>
              <BtnCheck
                options={[{ v: 'retiro_local', l: 'Retiro en local' }, { v: 'envio_disponible', l: 'Envío disponible' }]}
                values={atributos.entrega as string[] ?? []}
                onChange={v => setAttr('entrega', v)}
              />
            </FieldCard>
          </div>
        </>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export function NuevoProducto() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving]           = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [tiposAbertura, setTiposAbertura] = useState<TipoAbertura[]>([]);
  const [sistemas, setSistemas]       = useState<Sistema[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [colores, setColores]         = useState<{ id: string; nombre: string; hex: string | null }[]>([]);

  const [form, setForm] = useState({
    nombre:           '',
    codigo:           '',
    descripcion:      '',
    tipo:             'estandar' as TipoOperacion,
    tipo_abertura_id: '',
    sistema_id:       '',
    color:            '',
    ancho:            '',
    alto:             '',
    stock_inicial:    '0',
    stock_minimo:     '0',
    proveedor_id:     '',
    costo_base:       '',
    precio_base:      '',
    precio_por_m2:    false,
    imagen_url:       '',
    caracteristica_1: '',
    caracteristica_2: '',
    caracteristica_3: '',
    caracteristica_4: '',
    origen:           'proveedor' as 'proveedor' | 'fabricacion',
    vidrio:           '',
    premarco:         false,
    accesorios:       [] as string[],
    activo:           true,
  });
  const [atributos, setAtributos] = useState<Atributos>({});

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }
  function setAttr(key: string, value: unknown) {
    setAtributos(prev => ({ ...prev, [key]: value }));
  }

  const tipoAberturaObj = tiposAbertura.find(t => t.id === form.tipo_abertura_id);
  const esPuerta  = tipoAberturaObj?.nombre.toLowerCase().includes('puerta')  ?? false;
  const esVentana = tipoAberturaObj?.nombre.toLowerCase().includes('ventana') ?? false;

  useEffect(() => {
    Promise.all([
      api.get<TipoAbertura[]>('/catalogo/tipos-abertura'),
      api.get<Sistema[]>('/catalogo/sistemas'),
      api.get<Proveedor[]>('/catalogo/proveedores'),
      api.get<{ id: string; nombre: string; hex: string | null }[]>('/catalogo/colores'),
    ]).then(([ta, s, prov, col]) => {
      setTiposAbertura(ta);
      setSistemas(s);
      setProveedores(prov);
      setColores(col);
    });

    if (isEdit && id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.get<any>(`/productos/${id}`).then(data => {
        setForm({
          nombre:           data.nombre ?? '',
          codigo:           data.codigo ?? '',
          descripcion:      data.descripcion ?? '',
          tipo:             data.tipo,
          tipo_abertura_id: data.tipo_abertura_id ?? '',
          sistema_id:       data.sistema_id ?? '',
          color:            data.color ?? '',
          ancho:            data.ancho ? String(data.ancho) : '',
          alto:             data.alto ? String(data.alto) : '',
          stock_inicial:    String(data.stock_inicial ?? 0),
          stock_minimo:     String(data.stock_minimo ?? 0),
          proveedor_id:     data.proveedor_id ?? '',
          costo_base:       String(data.costo_base),
          precio_base:      String(data.precio_base),
          precio_por_m2:    data.precio_por_m2 ?? false,
          imagen_url:       data.imagen_url ?? '',
          caracteristica_1: data.caracteristica_1 ?? '',
          caracteristica_2: data.caracteristica_2 ?? '',
          caracteristica_3: data.caracteristica_3 ?? '',
          caracteristica_4: data.caracteristica_4 ?? '',
          origen:           data.tipo === 'fabricacion_propia' ? 'fabricacion' : 'proveedor',
          vidrio:           data.vidrio ?? '',
          premarco:         data.premarco ?? false,
          accesorios:       data.accesorios ?? [],
          activo:           data.activo ?? true,
        });
        if (data.atributos && typeof data.atributos === 'object') {
          setAtributos(data.atributos);
        }
      });
    }
  }, [id, isEdit]);

  // Default alto = 200 cm al detectar puerta (solo si campo vacío)
  useEffect(() => {
    if (esPuerta && !form.alto) set('alto', '200');
  }, [esPuerta]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const token = localStorage.getItem('aberturas_token');
      const res = await fetch('/api/productos/upload-imagen', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error('Error al subir imagen');
      const { url } = await res.json();
      set('imagen_url', url);
      toast.success('Imagen cargada');
    } catch {
      toast.error('No se pudo subir la imagen');
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const costo  = parseFloat(form.costo_base) || 0;
  const precio = parseFloat(form.precio_base) || 0;
  const margen = precio > 0 ? Math.round((precio - costo) / precio * 100) : 0;

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    if (!form.costo_base || !form.precio_base) { toast.error('Los precios son requeridos'); return; }

    setSaving(true);
    try {
      const tipoFinal: TipoOperacion = form.tipo === 'estandar'
        ? 'estandar'
        : form.origen === 'fabricacion' ? 'fabricacion_propia' : 'a_medida_proveedor';

      const payload = {
        nombre:           form.nombre.trim(),
        codigo:           form.codigo.trim() || null,
        descripcion:      form.descripcion.trim() || null,
        tipo:             tipoFinal,
        tipo_abertura_id: form.tipo_abertura_id || null,
        sistema_id:       form.sistema_id || null,
        color:            form.color || null,
        ancho:            form.ancho ? parseFloat(form.ancho) : null,
        alto:             form.alto  ? parseFloat(form.alto)  : null,
        stock_inicial:    parseInt(form.stock_inicial) || 0,
        stock_minimo:     parseInt(form.stock_minimo)  || 0,
        proveedor_id:     form.proveedor_id || null,
        costo_base:       parseFloat(form.costo_base),
        precio_base:      parseFloat(form.precio_base),
        precio_por_m2:    form.precio_por_m2,
        imagen_url:       form.imagen_url || null,
        caracteristica_1: form.caracteristica_1.trim() || null,
        caracteristica_2: form.caracteristica_2.trim() || null,
        caracteristica_3: form.caracteristica_3.trim() || null,
        caracteristica_4: form.caracteristica_4.trim() || null,
        vidrio:           form.tipo !== 'estandar' ? (form.vidrio || null) : null,
        premarco:         form.tipo !== 'estandar' ? form.premarco : false,
        accesorios:       form.tipo !== 'estandar' ? form.accesorios : [],
        activo:           form.activo,
        atributos:        (esPuerta || esVentana) ? atributos : {},
      };

      if (isEdit && id) {
        await api.put(`/productos/${id}`, payload);
        toast.success('Producto actualizado');
      } else {
        await api.post('/productos', payload);
        toast.success('Producto creado');
      }
      navigate('/productos');
    } catch (e) {
      toast.error((e as Error).message || 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white';
  const labelCls = 'block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

  const SectionHeader = ({ icon: Icon, label, primary = false }: { icon: React.ElementType; label: string; primary?: boolean }) => (
    <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', primary ? 'bg-sky-50 border-sky-100' : 'bg-gray-50 border-gray-100')}>
      <Icon size={13} className={primary ? 'text-sky-500' : 'text-gray-400'} />
      <span className={cn('text-[11px] font-semibold uppercase tracking-wider', primary ? 'text-sky-600' : 'text-gray-500')}>{label}</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <button onClick={() => navigate('/productos')} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
            <ArrowLeft size={17} className="text-gray-500" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
            <Package size={16} className="text-sky-600" />
          </div>
          <h1 className="text-base font-bold text-gray-900">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h1>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <button onClick={() => navigate('/productos')}
            className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium shadow-sm">
            <Save size={14} />
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>

      {/* Categoría */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Tag} label="Categoría de producto *" primary />
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIAS.map(t => (
            <button key={t.value} type="button" onClick={() => {
              set('tipo', t.value);
              set('precio_por_m2', false);
              set('ancho', '');
              set('alto', '');
            }}
              className={cn('text-left p-3.5 rounded-lg border-2 transition-all',
                form.tipo === t.value ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
              )}>
              <p className={cn('text-sm font-semibold', form.tipo === t.value ? 'text-sky-700' : 'text-gray-700')}>{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Datos principales */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={Package} label="Datos del producto" primary />
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus
                placeholder="Ej: Puerta aluminio Módena vidriada 0.90x2.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Código</label>
              <input value={form.codigo} onChange={e => set('codigo', e.target.value)}
                placeholder="Ej: PU-ALU-090" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tipo de abertura *</label>
            <select value={form.tipo_abertura_id} onChange={e => {
              set('tipo_abertura_id', e.target.value);
              setAtributos({});
            }} className={inputCls}>
              <option value="">Seleccionar tipo...</option>
              {tiposAbertura.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>

          {/* Aviso hasta que seleccione tipo */}
          {!form.tipo_abertura_id && (
            <p className="text-xs text-gray-400 italic">
              Seleccioná el tipo de abertura para ver las opciones correspondientes.
            </p>
          )}
        </div>
      </div>

      {/* ── SECCIÓN ESPECÍFICA PUERTAS ── */}
      {esPuerta && (
        <PuertaAtributos
          atributos={atributos}
          setAttr={setAttr}
          onAnchoChange={v => set('ancho', v !== null ? String(v) : '')}
          onColorChange={c => set('color', c)}
          colorActual={form.color}
        />
      )}

      {/* Medidas para puertas */}
      {esPuerta && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Ruler} label="Medidas de marco (cm)" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ancho total</label>
              <div className={cn(
                'w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-600 flex items-center justify-between',
                form.ancho ? 'border-emerald-300' : 'border-gray-200'
              )}>
                {form.ancho
                  ? <span className="font-mono font-semibold text-gray-800">{form.ancho} cm</span>
                  : <span className="italic text-gray-400 text-xs">Elegir config. de hojas →</span>
                }
                {form.ancho && <Check size={12} className="text-emerald-500 shrink-0" />}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Calculado · medida exterior de marco</p>
            </div>
            <div>
              <label className={labelCls}>Alto *</label>
              <div className="relative">
                <input type="number" min={100} max={400} value={form.alto}
                  onChange={e => set('alto', e.target.value)}
                  placeholder="200"
                  className={inputCls + ' pr-8'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">cm</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Medida exterior de marco · estándar 200 cm</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SECCIÓN ESPECÍFICA VENTANAS ── */}
      {esVentana && (
        <VentanaAtributos
          atributos={atributos}
          setAttr={setAttr}
          onColorChange={c => set('color', c)}
          colorActual={form.color}
        />
      )}

      {/* Medidas para ventanas (ambos libres, cm) */}
      {esVentana && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Ruler} label="Medidas de marco (cm)" />
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ancho *</label>
              <div className="relative">
                <input type="number" min={20} max={600} value={form.ancho}
                  onChange={e => set('ancho', e.target.value)}
                  placeholder="120"
                  className={inputCls + ' pr-8'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">cm</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Alto *</label>
              <div className="relative">
                <input type="number" min={20} max={400} value={form.alto}
                  onChange={e => set('alto', e.target.value)}
                  placeholder="100"
                  className={inputCls + ' pr-8'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">cm</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 px-4 pb-3">Medidas exteriores de marco</p>
        </div>
      )}

      {/* ── SECCIÓN GENÉRICA (otros tipos de abertura, no puerta ni ventana) ── */}
      {!esPuerta && !esVentana && form.tipo_abertura_id && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Ruler} label="Especificaciones" primary />
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sistema</label>
                <select value={form.sistema_id} onChange={e => set('sistema_id', e.target.value)} className={inputCls}>
                  <option value="">Seleccionar...</option>
                  {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <select value={form.color} onChange={e => set('color', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {colores.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
            </div>

            {form.tipo === 'estandar' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ancho (m)</label>
                  <input type="number" value={form.ancho} onChange={e => set('ancho', e.target.value)} placeholder="0.90" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Alto (m)</label>
                  <input type="number" value={form.alto} onChange={e => set('alto', e.target.value)} placeholder="2.00" className={inputCls} />
                </div>
              </div>
            )}

            {form.tipo !== 'estandar' && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.precio_por_m2}
                  onChange={e => set('precio_por_m2', e.target.checked)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                <span className="text-sm text-gray-700">Precio base por m²</span>
                <span className="text-xs text-gray-400">(se multiplica por medidas del presupuesto)</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* A medida — campos extra (solo genérico, no puerta ni ventana) */}
      {form.tipo !== 'estandar' && !esPuerta && !esVentana && form.tipo_abertura_id && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Ruler} label="Detalles a medida / fabricación" primary />
          <div className="p-4 space-y-4">
            <div>
              <label className={labelCls}>Origen *</label>
              <div className="flex gap-3">
                {(['proveedor', 'fabricacion'] as const).map(op => (
                  <label key={op} className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all flex-1 justify-center',
                    form.origen === op ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
                  )}>
                    <input type="radio" name="origen" value={op} checked={form.origen === op}
                      onChange={() => set('origen', op)} className="accent-sky-600" />
                    <span className={cn('text-sm font-semibold', form.origen === op ? 'text-sky-700' : 'text-gray-700')}>
                      {op === 'proveedor' ? 'Proveedor' : 'Fabricación propia'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Ancho (m)</label>
                <input type="number" value={form.ancho} onChange={e => set('ancho', e.target.value)} placeholder="0.90" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alto (m)</label>
                <input type="number" value={form.alto} onChange={e => set('alto', e.target.value)} placeholder="2.00" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Vidrio</label>
              <select value={form.vidrio} onChange={e => set('vidrio', e.target.value)} className={inputCls}>
                <option value="">— Sin especificar —</option>
                {['Transparente', 'Traslúcido', 'Laminado', 'DVH', 'Sin vidrio'].map(v =>
                  <option key={v} value={v}>{v}</option>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Premarco</label>
                <select value={form.premarco ? 'si' : 'no'} onChange={e => set('premarco', e.target.value === 'si')} className={inputCls}>
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Accesorios</label>
                <select multiple value={form.accesorios}
                  onChange={e => set('accesorios', Array.from(e.target.selectedOptions).map(o => o.value))}
                  className={inputCls + ' h-24'}>
                  {['Barral', 'Cerradura', 'Manijón', 'Otros'].map(a =>
                    <option key={a} value={a}>{a}</option>
                  )}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Ctrl+clic para varios</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock + Proveedor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Boxes} label="Stock" />
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stock inicial</label>
              <input type="number" min={0} value={form.stock_inicial}
                onChange={e => set('stock_inicial', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stock mínimo</label>
              <input type="number" min={0} value={form.stock_minimo}
                onChange={e => set('stock_minimo', e.target.value)} placeholder="0" className={inputCls} />
              <p className="text-[10px] text-gray-400 mt-1">Alerta de reposición</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <SectionHeader icon={Tag} label="Proveedor" />
          <div className="p-4">
            <label className={labelCls}>Proveedor</label>
            <select value={form.proveedor_id} onChange={e => set('proveedor_id', e.target.value)} className={inputCls}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Precios */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={DollarSign} label={`Precios base${form.precio_por_m2 ? ' (por m²)' : ''}`} />
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Costo *</label>
              <input type="number" min={0} value={form.costo_base}
                onChange={e => set('costo_base', e.target.value)} placeholder="0" className={inputCls} />
              {costo > 0 && (
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  $ {costo.toLocaleString('es-AR')}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Precio de venta *</label>
              <input type="number" min={0} value={form.precio_base}
                onChange={e => set('precio_base', e.target.value)} placeholder="0" className={inputCls} />
              {precio > 0 && (
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  $ {precio.toLocaleString('es-AR')}
                </p>
              )}
            </div>
          </div>
          {precio > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Margen:</span>
              <span className={cn('font-semibold', margen >= 30 ? 'text-green-600' : margen >= 15 ? 'text-amber-600' : 'text-red-600')}>
                {margen}%
              </span>
              <span className="text-gray-400 text-xs">({formatCurrency(precio - costo)} por unidad)</span>
            </div>
          )}
        </div>
      </div>

      {/* Imagen */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={ImageIcon} label="Imagen del producto" />
        <div className="p-4 flex items-start gap-4">
          <div className="w-28 h-28 shrink-0 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
            {form.imagen_url
              ? <img src={form.imagen_url} alt="preview" className="w-full h-full object-cover" />
              : <ImageIcon size={28} className="text-gray-300" />
            }
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingImg}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors">
              <Upload size={14} />
              {uploadingImg ? 'Subiendo...' : 'Elegir imagen'}
            </button>
            {form.imagen_url && (
              <button type="button" onClick={() => set('imagen_url', '')}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600">
                <X size={11} /> Quitar imagen
              </button>
            )}
            <p className="text-[11px] text-gray-400">JPG, PNG o WebP.</p>
          </div>
        </div>
      </div>

      {/* Características */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <SectionHeader icon={FileText} label="Características del producto" />
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n}>
                <label className={labelCls}>Característica {n}</label>
                <input value={form[`caracteristica_${n}` as keyof typeof form] as string}
                  onChange={e => set(`caracteristica_${n}`, e.target.value)}
                  placeholder="Ej: Burlete de goma incluido"
                  className={inputCls} />
              </div>
            ))}
          </div>
          <div>
            <label className={labelCls}>Descripción / Notas internas</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={2} placeholder="Notas internas, referencias de proveedor..."
              className={inputCls + ' resize-none'} />
          </div>
        </div>
      </div>

      {/* Botón guardar al final */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={() => navigate('/productos')}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold shadow-sm">
          <Save size={15} />
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>

    </div>
  );
}
