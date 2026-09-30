import { cuitValido } from './cuit.js';
import { leerConfig, leerPuntosVenta } from './config.js';
import { leerCredenciales, leerCsr } from '../arca/secretos.js';
import { feDummy, puntosDeVenta, tiposComprobante, ultimoAutorizado, type ContextoArca } from '../arca/wsfe.js';
import { obtenerTicket } from '../arca/wsaa.js';
import { ArcaError } from '../arca/soap.js';
import { db } from '../../db.js';

// Checklist de puesta en marcha (semáforo de Configuración > Facturación). Los puntos
// "local" se evalúan siempre; los que hablan con ARCA solo con `conArca` (botón "Probar
// conexión"), porque pegan a los servicios reales y dejan registro.

export type Semaforo = 'ok' | 'aviso' | 'error' | 'pendiente';
export interface ItemChecklist { clave: string; titulo: string; estado: Semaforo; detalle: string; obligatorio: boolean }

const NOMBRE_AMBIENTE = { homologacion: 'homologación', produccion: 'producción' } as const;

const TIPOS_REQUERIDOS: [number, string][] = [[1, 'Factura A'], [6, 'Factura B'], [3, 'Nota de Crédito A'], [8, 'Nota de Crédito B']];

export async function diagnosticar(conArca: boolean, usuarioId?: string | null): Promise<ItemChecklist[]> {
  const cfg = await leerConfig();
  const pvs = (await leerPuntosVenta()).filter(p => p.activo);
  const items: ItemChecklist[] = [];
  const add = (clave: string, titulo: string, estado: Semaforo, detalle: string, obligatorio = true) =>
    items.push({ clave, titulo, estado, detalle, obligatorio });

  // ── Locales ────────────────────────────────────────────────────────────────
  const faltan = [
    !cuitValido(cfg.cuit) && 'CUIT válido',
    !cfg.razon_social?.trim() && 'razón social',
    !cfg.domicilio_fiscal?.trim() && 'domicilio fiscal',
    !cfg.iibb?.trim() && 'Ingresos Brutos',
    !cfg.inicio_actividades && 'inicio de actividades',
  ].filter(Boolean) as string[];
  add('datos', 'Datos fiscales del emisor', faltan.length ? 'error' : 'ok',
    faltan.length ? `Falta: ${faltan.join(', ')}` : `${cfg.razon_social} · CUIT ${cfg.cuit}`);

  const secretoOk = (process.env.FISCAL_KEY_SECRET ?? '').length >= 16;
  add('secreto', 'Protección de la clave (FISCAL_KEY_SECRET)', secretoOk ? 'ok' : 'error',
    secretoOk ? 'Configurada en el servidor' : 'Falta la variable FISCAL_KEY_SECRET en el servidor (mínimo 16 caracteres)');

  // Disco y base tienen que coincidir: si la base dice "sin clave" (p. ej. se restauró un
  // backup viejo) los archivos que hubiera no cuentan como configurados.
  const csr = secretoOk && cfg.cert_estado !== 'sin_clave' ? await leerCsr() : null;
  add('csr', 'Clave privada y solicitud (CSR)', csr ? 'ok' : 'pendiente',
    csr ? 'Generadas en el servidor' : 'Generar la solicitud y subirla a ARCA');

  let cred = null;
  try { cred = csr ? await leerCredenciales(cfg.ambiente) : null; } catch { cred = null; }
  if (!cred) {
    add('certificado', `Certificado de ${NOMBRE_AMBIENTE[cfg.ambiente]}`, 'pendiente', 'Cargar el .crt que entrega ARCA para este ambiente');
  } else {
    const dias = Math.floor((cred.info.vencimiento.getTime() - Date.now()) / 86400_000);
    add('certificado', `Certificado de ${NOMBRE_AMBIENTE[cfg.ambiente]}`, dias < 0 ? 'error' : dias < 30 ? 'aviso' : 'ok',
      dias < 0 ? 'Vencido' : `Vence en ${dias} días (${cred.info.vencimiento.toLocaleDateString('es-AR')})`);
  }

  const pvCae = pvs.filter(p => p.modo === 'CAE');
  add('pv_cae', 'Punto de venta para emisión online (CAE)', pvCae.length ? 'ok' : 'pendiente',
    pvCae.length ? `N° ${pvCae.map(p => p.numero).join(', ')}` : 'Dar de alta en ARCA un punto de venta "web service" y cargarlo acá');
  const pvCaea = pvs.filter(p => p.modo === 'CAEA');
  add('pv_caea', 'Punto de venta para contingencia (CAEA)', pvCaea.length ? 'ok' : 'aviso',
    pvCaea.length ? `N° ${pvCaea.map(p => p.numero).join(', ')}` : 'Recomendado: sin él no se puede facturar si ARCA está caído', false);

  // ── Contra ARCA ────────────────────────────────────────────────────────────
  const clavesArca = ['servicio', 'reloj', 'token', 'pv_arca', 'tipos', 'numeracion'] as const;
  const titulosArca: Record<(typeof clavesArca)[number], string> = {
    servicio: 'ARCA responde', reloj: 'Hora del servidor sincronizada', token: 'Acceso autorizado (ticket WSAA)',
    pv_arca: 'Puntos de venta habilitados en ARCA', tipos: 'Comprobantes habilitados (A, B, notas de crédito)',
    numeracion: 'Numeración leída de ARCA',
  };
  if (!conArca || !cred || !cuitValido(cfg.cuit)) {
    for (const k of clavesArca) {
      add(k, titulosArca[k], 'pendiente', conArca ? 'Requiere datos fiscales y certificado' : 'Usar "Probar conexión"');
    }
    return items;
  }

  const ctx: ContextoArca = { ambiente: cfg.ambiente, cuit: cfg.cuit!, usuarioId, timeoutMs: 20_000 };
  const msg = (e: unknown) => e instanceof ArcaError ? e.message : String((e as Error)?.message ?? e);
  const cortar = (desde: number, motivo: string) => {
    for (const k of clavesArca.slice(desde)) add(k, titulosArca[k], 'pendiente', motivo);
  };

  try {
    const d = await feDummy(ctx);
    const ok = [d.appServer, d.dbServer, d.authServer].every(v => v === 'OK');
    add('servicio', titulosArca.servicio, ok ? 'ok' : 'error',
      ok ? `Servicio de ${NOMBRE_AMBIENTE[cfg.ambiente]} operativo` : `Estado: app ${d.appServer}, base ${d.dbServer}, auth ${d.authServer}`);
    if (d.fechaServidor) {
      const dif = Math.round(Math.abs(d.fechaServidor.getTime() - Date.now()) / 1000);
      add('reloj', titulosArca.reloj, dif > 120 ? 'error' : dif > 30 ? 'aviso' : 'ok',
        dif > 30 ? `Diferencia de ${dif} s con ARCA: sincronizar la hora (NTP)` : `Diferencia de ${dif} s`);
    } else {
      add('reloj', titulosArca.reloj, 'aviso', 'ARCA no informó su hora');
    }
  } catch (e) {
    add('servicio', titulosArca.servicio, 'error', msg(e));
    cortar(1, 'ARCA no responde');
    return guardarResultado(items);
  }

  try {
    const t = await obtenerTicket(cfg.ambiente, 'wsfe', cfg.cuit!);
    add('token', titulosArca.token, 'ok', `Vigente hasta ${t.expira.toLocaleString('es-AR')}`);
  } catch (e) {
    add('token', titulosArca.token, 'error', msg(e));
    cortar(3, 'Sin acceso autorizado');
    return guardarResultado(items);
  }

  try {
    const enArca = await puntosDeVenta(ctx);
    const problemas = pvs.map(pv => {
      const a = enArca.find(x => x.numero === pv.numero);
      if (!a) return `el ${pv.numero} no existe en ARCA como web service`;
      if (a.bloqueado || a.baja) return `el ${pv.numero} está ${a.bloqueado ? 'bloqueado' : 'dado de baja'}`;
      return null;
    }).filter(Boolean);
    add('pv_arca', titulosArca.pv_arca, problemas.length || !pvs.length ? 'error' : 'ok',
      problemas.length ? `Revisar: ${problemas.join('; ')}`
        : pvs.length ? `ARCA reconoce: ${enArca.map(p => `${p.numero} (${p.emisionTipo})`).join(', ')}`
          : `En ARCA hay: ${enArca.map(p => p.numero).join(', ') || 'ninguno'}; falta cargarlos acá`);
  } catch (e) {
    add('pv_arca', titulosArca.pv_arca, 'error', msg(e));
  }

  try {
    const tipos = await tiposComprobante(ctx);
    const faltanTipos = TIPOS_REQUERIDOS.filter(([id]) => !tipos.some(t => t.id === id)).map(([, n]) => n);
    add('tipos', titulosArca.tipos, faltanTipos.length ? 'error' : 'ok',
      faltanTipos.length ? `ARCA no habilita: ${faltanTipos.join(', ')}` : 'Factura A/B y notas de crédito disponibles');
  } catch (e) {
    add('tipos', titulosArca.tipos, 'error', msg(e));
  }

  try {
    const lecturas: string[] = [];
    for (const pv of pvCae) {
      for (const [tipo, nombre] of TIPOS_REQUERIDOS.slice(0, 2)) {
        lecturas.push(`${nombre} ${String(pv.numero).padStart(5, '0')}: último ${await ultimoAutorizado(ctx, pv.numero, tipo)}`);
      }
    }
    add('numeracion', titulosArca.numeracion, lecturas.length ? 'ok' : 'pendiente',
      lecturas.length ? lecturas.join(' · ') : 'Sin puntos de venta CAE para consultar');
  } catch (e) {
    add('numeracion', titulosArca.numeracion, 'error', msg(e));
  }

  return guardarResultado(items);
}

async function guardarResultado(items: ItemChecklist[]) {
  const ok = items.filter(i => i.obligatorio).every(i => i.estado === 'ok' || i.estado === 'aviso');
  await db.query(
    `UPDATE fiscal_config SET ultima_prueba_at = now(), ultima_prueba_ok = $1, ultima_prueba_json = $2 WHERE id = 1`,
    [ok, JSON.stringify(items)]);
  return items;
}

/** Se puede habilitar la facturación solo con todos los puntos obligatorios en verde/amarillo. */
export function listoParaHabilitar(items: ItemChecklist[]): boolean {
  return items.filter(i => i.obligatorio).every(i => i.estado === 'ok' || i.estado === 'aviso');
}
