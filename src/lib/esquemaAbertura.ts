// Esquema de una abertura a medida (Compras) como SVG en texto: marco proporcional, hojas, sectores con vidrio
// o ciegos, travesaños, símbolo de apertura y cotas. Se ve en pantalla y va en el PDF al proveedor.
// Convención de dibujo: vista desde adentro; en las de abrir las líneas del triángulo convergen en el lado de
// las bisagras; en las corredizas, flechas; en proyectante/banderola el vértice marca el lado del eje.
//
// COPIA IDÉNTICA en server/src/lib/esquemaAbertura.ts (test `configurador-espejo`). Solo importa el configurador.

import { divisionesDe, sectoresDe, type Ficha } from './configuradorAbertura.js';

const VIDRIO = '#cfe8f7';
const CIEGO = '#c9ccd1';
const TRAZO = '#1f2937';
const SIMBOLO = '#2563eb';

export function esquemaAberturaSVG(f: Ficha, opts: { ancho?: number } = {}): string {
  const anchoMm = Number(f.ancho_m) * 1000 || 1200;
  const altoMm = Number(f.alto_m) * 1000 || 1500;
  const margen = 34;                 // lugar para las cotas
  const caja = 220;
  const escala = caja / Math.max(anchoMm, altoMm);
  const w = anchoMm * escala;
  const h = altoMm * escala;
  const x0 = margen;
  const y0 = 12;
  const vbW = w + margen + 16;
  const vbH = h + y0 + margen;
  const sinMedidas = !(Number(f.ancho_m) > 0 && Number(f.alto_m) > 0);
  const partes: string[] = [];

  // Sectores (franjas entre travesaños horizontales, de abajo hacia arriba)
  const horizontales = divisionesDe(f).filter(d => d.orientacion === 'horizontal').map(d => d.posicion_mm);
  const sectores = sectoresDe(f);
  const cortes = [0, ...horizontales, altoMm];
  sectores.forEach((s, i) => {
    const yb = y0 + h - cortes[i] * escala;
    const yt = y0 + h - cortes[i + 1] * escala;
    partes.push(`<rect x="${n(x0)}" y="${n(yt)}" width="${n(w)}" height="${n(yb - yt)}" fill="${s === 'ciego' ? CIEGO : VIDRIO}"/>`);
  });

  // Hojas
  const tipologia = typeof f.tipologia === 'string' ? f.tipologia : '';
  const hojas = Math.max(1, Number(f.hojas) || (tipologia === 'corrediza' ? 2 : 1));
  const anchoHoja = w / hojas;
  for (let i = 1; i < hojas; i++) linea(partes, x0 + anchoHoja * i, y0, x0 + anchoHoja * i, y0 + h, TRAZO, 1.6);

  // Travesaños
  for (const d of divisionesDe(f)) {
    if (d.orientacion === 'horizontal') { const y = y0 + h - d.posicion_mm * escala; linea(partes, x0, y, x0 + w, y, TRAZO, 1.4); }
    else { const x = x0 + d.posicion_mm * escala; linea(partes, x, y0, x, y0 + h, TRAZO, 1.4); }
  }

  // Símbolo de apertura por hoja
  for (let i = 0; i < hojas; i++) {
    const xa = x0 + anchoHoja * i;
    const xb = xa + anchoHoja;
    const p = 6;
    switch (tipologia) {
      case 'corrediza': {
        const y = y0 + h / 2;
        const dir = i % 2 === 0 ? 1 : -1;
        const c = (xa + xb) / 2;
        const l = Math.min(anchoHoja * 0.3, 26);
        linea(partes, c - l, y, c + l, y, SIMBOLO, 1.4);
        const punta = c + dir * l;
        partes.push(`<path d="M${n(punta)} ${n(y)} l${n(-dir * 6)} -4 M${n(punta)} ${n(y)} l${n(-dir * 6)} 4" stroke="${SIMBOLO}" stroke-width="1.4" fill="none"/>`);
        break;
      }
      case 'de_abrir':
      case 'oscilobatiente':
      case 'plegadiza': {
        // Con dos hojas, una abre hacia cada lado; con una, según el sentido
        const bisagraIzq = hojas === 1 ? f.sentido !== 'derecha' : i % 2 === 0;
        const xBis = bisagraIzq ? xa + p : xb - p;
        const xLibre = bisagraIzq ? xb - p : xa + p;
        triangulo(partes, xLibre, y0 + p, xLibre, y0 + h - p, xBis, y0 + h / 2);
        if (tipologia === 'oscilobatiente') triangulo(partes, xa + p, y0 + p, xb - p, y0 + p, (xa + xb) / 2, y0 + h - p);
        break;
      }
      case 'proyectante':  triangulo(partes, xa + p, y0 + h - p, xb - p, y0 + h - p, (xa + xb) / 2, y0 + p); break;
      case 'banderola':    triangulo(partes, xa + p, y0 + p, xb - p, y0 + p, (xa + xb) / 2, y0 + h - p); break;
      case 'ventiluz':     partes.push(`<line x1="${n(xa + p)}" y1="${n(y0 + h / 2)}" x2="${n(xb - p)}" y2="${n(y0 + h / 2)}" stroke="${SIMBOLO}" stroke-width="1.2" stroke-dasharray="5 3"/>`); break;
      case 'fijo':         texto(partes, (xa + xb) / 2, y0 + h / 2 + 4, 'F', 12, SIMBOLO); break;
    }
  }

  // Marco
  partes.push(`<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${TRAZO}" stroke-width="2.4"/>`);

  // Cotas
  if (!sinMedidas) {
    const yc = y0 + h + 16;
    linea(partes, x0, yc, x0 + w, yc, '#6b7280', 0.8);
    texto(partes, x0 + w / 2, yc + 12, `${Math.round(anchoMm)} mm`, 10, '#374151');
    const xc = x0 - 14;
    linea(partes, xc, y0, xc, y0 + h, '#6b7280', 0.8);
    partes.push(`<text x="${n(xc - 4)}" y="${n(y0 + h / 2)}" font-size="10" fill="#374151" text-anchor="middle" font-family="Arial, sans-serif" transform="rotate(-90 ${n(xc - 4)} ${n(y0 + h / 2)})">${Math.round(altoMm)} mm</text>`);
  }
  const accesorios = Array.isArray(f.accesorios_lista) ? f.accesorios_lista as string[] : [];
  if (accesorios.includes('mosquitero')) texto(partes, x0 + w - 4, y0 + 12, 'c/ mosquitero', 8, '#047857', 'end');

  const anchoPx = opts.ancho ?? 260;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(vbW)} ${n(vbH)}" width="${anchoPx}" height="${n(anchoPx * vbH / vbW)}" role="img" aria-label="Esquema de la abertura">${partes.join('')}</svg>`;
}

function n(v: number): string { return (Math.round(v * 10) / 10).toString(); }
function linea(p: string[], x1: number, y1: number, x2: number, y2: number, color: string, ancho: number) {
  p.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${ancho}"/>`);
}
function triangulo(p: string[], ax: number, ay: number, bx: number, by: number, vx: number, vy: number) {
  p.push(`<path d="M${n(ax)} ${n(ay)} L${n(vx)} ${n(vy)} L${n(bx)} ${n(by)}" stroke="${SIMBOLO}" stroke-width="1.2" fill="none" stroke-dasharray="6 3"/>`);
}
function texto(p: string[], x: number, y: number, t: string, size: number, color: string, anchor = 'middle') {
  const seguro = t.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
  p.push(`<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-family="Arial, sans-serif">${seguro}</text>`);
}
