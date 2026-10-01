import http from 'node:http';
import forge from 'node-forge';
import type { AddressInfo } from 'node:net';

// Servidor ARCA simulado para tests: responde WSAA (loginCms) y WSFEv1 con el mismo XML
// que los servicios reales (manual WSFEv1 v4.8). Verifica que el pedido de token venga
// firmado en CMS "attached" con un TRA adentro, como exige ARCA.

export interface EstadoFake {
  logins: number;
  llamadas: string[];                               // métodos invocados, en orden
  ultimos: Map<string, number>;                     // `${ptoVta}-${tipo}` → último número
  puntosVenta: { nro: number; tipo: string; bloqueado?: boolean }[];
  /** Si se define, el próximo pedido a ese método tarda esto (ms) antes de responder. */
  demora: Partial<Record<string, number>>;
  /** Errores forzados por método: se devuelven en <Errors> una sola vez. */
  errores: Partial<Record<string, { code: string; msg: string }>>;
  /** Procesa el pedido (ARCA autoriza) pero demora la respuesta esto (ms): simula perderla. */
  demoraDespues: Partial<Record<string, number>>;
  /** El próximo FECompUltimoAutorizado devuelve un número atrasado (fuerza el 10016). */
  ultimoAtrasado: number;
  /** Métodos que se reciben pero nunca se procesan: la conexión se corta sin respuesta. */
  tragar: Set<string>;
  /** ARCA caído: WSFE responde 503 (salvo los métodos de CAEA, que se usan al volver). */
  caido: boolean;
  /** CAEA otorgados: `${periodo}-${orden}` → código. */
  caeas: Map<string, string>;
  /** Informes "sin movimiento" recibidos: `${ptoVta}-${caea}`. */
  sinMovimiento: string[];
  /** Comprobantes autorizados: `${ptoVta}-${tipo}-${nro}` → datos. */
  emitidos: Map<string, Record<string, string>>;
}

const soap = (cuerpo: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"` +
  ` xmlns="http://ar.gov.afip.dif.FEV1/"><soap:Body>${cuerpo}</soap:Body></soap:Envelope>`;

const fault = (code: string, msg: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
  `<soapenv:Body><soapenv:Fault><faultcode>ns1:${code}</faultcode><faultstring>${msg}</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;

const tag = (xml: string, t: string) => xml.match(new RegExp(`<(?:\\w+:)?${t}>([^<]*)</(?:\\w+:)?${t}>`))?.[1];

/** Contenido firmado de un CMS (vacío si es detached). */
export function contenidoFirmado(p7: forge.pkcs7.PkcsSignedData): string {
  const raw = (p7 as unknown as { rawCapture?: { content?: forge.asn1.Asn1 } }).rawCapture?.content;
  const nodo = Array.isArray(raw?.value) ? (raw!.value[0] as forge.asn1.Asn1) : raw;
  return typeof nodo?.value === 'string' ? nodo.value : '';
}

function manejarWsaa(xml: string, e: EstadoFake): string {
  const cms = tag(xml, 'in0');
  if (!cms) return fault('cms.bad', 'Falta el CMS');
  try {
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(cms))) as forge.pkcs7.PkcsSignedData;
    const tra = contenidoFirmado(p7);
    if (!tra.includes('<loginTicketRequest')) return fault('cms.sign.invalid', 'CMS detached o sin TRA');
    if (!p7.certificates?.length) return fault('cms.cert.notFound', 'El CMS no trae certificado');
  } catch {
    return fault('cms.bad', 'CMS mal formado');
  }
  e.logins++;
  const exp = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  const ticket =
    `<?xml version="1.0" encoding="UTF-8"?><loginTicketResponse version="1.0"><header>` +
    `<expirationTime>${exp}</expirationTime></header><credentials><token>TOKEN-${e.logins}</token>` +
    `<sign>SIGN-${e.logins}</sign></credentials></loginTicketResponse>`;
  const escapado = ticket.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soapenv:Body><loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><loginCmsReturn>${escapado}</loginCmsReturn>` +
    `</loginCmsResponse></soapenv:Body></soapenv:Envelope>`;
}

function manejarWsfe(metodo: string, xml: string, e: EstadoFake): string {
  const resp = (interior: string) => soap(`<${metodo}Response><${metodo}Result>${interior}</${metodo}Result></${metodo}Response>`);
  const forzado = e.errores[metodo];
  if (forzado) {
    delete e.errores[metodo];
    return resp(`<Errors><Err><Code>${forzado.code}</Code><Msg>${forzado.msg}</Msg></Err></Errors>`);
  }
  if (metodo !== 'FEDummy' && !tag(xml, 'Token')?.startsWith('TOKEN-')) {
    return resp(`<Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No aparecio CUIT en lista de relaciones</Msg></Err></Errors>`);
  }
  switch (metodo) {
    case 'FEDummy':
      return resp('<AppServer>OK</AppServer><DbServer>OK</DbServer><AuthServer>OK</AuthServer>');
    case 'FECompUltimoAutorizado': {
      const pv = Number(tag(xml, 'PtoVta')); const tipo = Number(tag(xml, 'CbteTipo'));
      let ultimo = e.ultimos.get(`${pv}-${tipo}`) ?? 0;
      if (e.ultimoAtrasado > 0) { e.ultimoAtrasado--; ultimo = Math.max(0, ultimo - 1); }
      return resp(`<PtoVta>${pv}</PtoVta><CbteTipo>${tipo}</CbteTipo><CbteNro>${ultimo}</CbteNro>`);
    }
    case 'FEParamGetPtosVenta':
      if (!e.puntosVenta.length) return resp('<Errors><Err><Code>602</Code><Msg>Sin Resultados</Msg></Err></Errors>');
      return resp(`<ResultGet>${e.puntosVenta.map(p =>
        `<PtoVenta><Nro>${p.nro}</Nro><EmisionTipo>${p.tipo}</EmisionTipo><Bloqueado>${p.bloqueado ? 'S' : 'N'}</Bloqueado><FchBaja>NULL</FchBaja></PtoVenta>`).join('')}</ResultGet>`);
    case 'FEParamGetTiposCbte':
      return resp(`<ResultGet>${[[1, 'Factura A'], [2, 'Nota de Débito A'], [3, 'Nota de Crédito A'], [6, 'Factura B'], [7, 'Nota de Débito B'], [8, 'Nota de Crédito B']]
        .map(([id, d]) => `<CbteTipo><Id>${id}</Id><Desc>${d}</Desc><FchDesde>20100917</FchDesde><FchHasta>NULL</FchHasta></CbteTipo>`).join('')}</ResultGet>`);
    case 'FEParamGetCondicionIvaReceptor':
      return resp(`<ResultGet>${[[1, 'IVA Responsable Inscripto', 'A/M/C'], [4, 'IVA Sujeto Exento', 'B/C'], [5, 'Consumidor Final', 'B/C'], [6, 'Responsable Monotributo', 'A/M/C']]
        .map(([id, d, c]) => `<CondicionIvaReceptor><Id>${id}</Id><Desc>${d}</Desc><Cmp_Clase>${c}</Cmp_Clase></CondicionIvaReceptor>`).join('')}</ResultGet>`);
    case 'FECompConsultar': {
      const c = e.emitidos.get(`${tag(xml, 'PtoVta')}-${tag(xml, 'CbteTipo')}-${tag(xml, 'CbteNro')}`);
      if (!c) return resp('<Errors><Err><Code>602</Code><Msg>No existen datos en nuestros registros para los parametros ingresados.</Msg></Err></Errors>');
      return resp(`<ResultGet>${Object.entries(c).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</ResultGet>`);
    }
    case 'FECAESolicitar':
      return solicitarCae(xml, e, resp);
    case 'FECAEASolicitar':
    case 'FECAEAConsultar': {
      const periodo = Number(tag(xml, 'Periodo')); const orden = Number(tag(xml, 'Orden'));
      const clave = `${periodo}-${orden}`;
      if (metodo === 'FECAEASolicitar' && e.caeas.has(clave)) {
        return resp('<Errors><Err><Code>15008</Code><Msg>Existe un CAEA otorgado para el periodo y orden solicitado</Msg></Err></Errors>');
      }
      if (metodo === 'FECAEAConsultar' && !e.caeas.has(clave)) return resp('<Errors><Err><Code>602</Code><Msg>Sin resultados</Msg></Err></Errors>');
      if (!e.caeas.has(clave)) e.caeas.set(clave, String(26000000000000 + periodo * 10 + orden));
      const y = Math.floor(periodo / 100), m = periodo % 100;
      const ult = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const mm = String(m).padStart(2, '0');
      const desde = `${y}${mm}${orden === 1 ? '01' : '16'}`, hasta = `${y}${mm}${orden === 1 ? '15' : ult}`;
      const tope = new Date(Date.UTC(y, m - 1, Number(hasta.slice(6)) + 8)).toISOString().slice(0, 10).replace(/-/g, '');
      return resp(`<ResultGet><CAEA>${e.caeas.get(clave)}</CAEA><Periodo>${periodo}</Periodo><Orden>${orden}</Orden>` +
        `<FchVigDesde>${desde}</FchVigDesde><FchVigHasta>${hasta}</FchVigHasta><FchTopeInf>${tope}</FchTopeInf>` +
        `<FchProceso>20261001120000</FchProceso></ResultGet>`);
    }
    case 'FECAEARegInformativo': {
      const pv = Number(tag(xml, 'PtoVta')); const tipo = Number(tag(xml, 'CbteTipo')); const nro = Number(tag(xml, 'CbteDesde'));
      const caea = tag(xml, 'CAEA') ?? '';
      const det = (res: string, extra = '') => resp(
        `<FeCabResp><Cuit>20111111112</Cuit><PtoVta>${pv}</PtoVta><CbteTipo>${tipo}</CbteTipo><FchProceso>20261001120000</FchProceso>` +
        `<CantReg>1</CantReg><Resultado>${res}</Resultado></FeCabResp><FeDetResp><FECAEADetResponse><CbteDesde>${nro}</CbteDesde>` +
        `<CbteHasta>${nro}</CbteHasta><Resultado>${res}</Resultado><CAEA>${caea}</CAEA>${extra}</FECAEADetResponse></FeDetResp>`);
      if (![...e.caeas.values()].includes(caea)) return det('R', '<Observaciones><Obs><Code>724</Code><Msg>CAEA inexistente</Msg></Obs></Observaciones>');
      if (!tag(xml, 'CbteFchHsGen')) return det('R', '<Observaciones><Obs><Code>1018</Code><Msg>CbteFchHsGen obligatorio</Msg></Obs></Observaciones>');
      const ultimo = e.ultimos.get(`${pv}-${tipo}`) ?? 0;
      if (nro !== ultimo + 1) return det('R', '<Observaciones><Obs><Code>10016</Code><Msg>Numero no correlativo</Msg></Obs></Observaciones>');
      e.ultimos.set(`${pv}-${tipo}`, nro);
      e.emitidos.set(`${pv}-${tipo}-${nro}`, {
        Concepto: tag(xml, 'Concepto')!, DocTipo: tag(xml, 'DocTipo')!, DocNro: tag(xml, 'DocNro')!, CbteDesde: String(nro),
        CbteHasta: String(nro), CbteFch: tag(xml, 'CbteFch')!, ImpTotal: tag(xml, 'ImpTotal')!, CodAutorizacion: caea,
        EmisionTipo: 'CAEA', FchVto: '', Resultado: 'A', PtoVta: String(pv), CbteTipo: String(tipo),
      });
      return det('A');
    }
    case 'FECAEASinMovimientoInformar':
      e.sinMovimiento.push(`${tag(xml, 'PtoVta')}-${tag(xml, 'CAEA')}`);
      return resp(`<CAEA>${tag(xml, 'CAEA')}</CAEA><FchProceso>20261001</FchProceso><PtoVta>${tag(xml, 'PtoVta')}</PtoVta><Resultado>A</Resultado>`);
    default:
      return fault('Client', `Método no simulado: ${metodo}`);
  }
}

function solicitarCae(xml: string, e: EstadoFake, resp: (s: string) => string): string {
  const pv = Number(tag(xml, 'PtoVta')); const tipo = Number(tag(xml, 'CbteTipo'));
  const nro = Number(tag(xml, 'CbteDesde'));
  const det = (resultado: string, extra: string) =>
    resp(`<FeCabResp><Cuit>20111111112</Cuit><PtoVta>${pv}</PtoVta><CbteTipo>${tipo}</CbteTipo><FchProceso>20261001120000</FchProceso>` +
      `<CantReg>1</CantReg><Resultado>${resultado}</Resultado><Reproceso>N</Reproceso></FeCabResp>` +
      `<FeDetResp><FECAEDetResponse><Concepto>${tag(xml, 'Concepto')}</Concepto><DocTipo>${tag(xml, 'DocTipo')}</DocTipo>` +
      `<DocNro>${tag(xml, 'DocNro')}</DocNro><CbteDesde>${nro}</CbteDesde><CbteHasta>${nro}</CbteHasta>` +
      `<CbteFch>${tag(xml, 'CbteFch')}</CbteFch><Resultado>${resultado}</Resultado>${extra}</FECAEDetResponse></FeDetResp>`);
  const obs = (code: string, msg: string) => det('R', `<Observaciones><Obs><Code>${code}</Code><Msg>${msg}</Msg></Obs></Observaciones><CAE></CAE><CAEFchVto></CAEFchVto>`);

  if (!tag(xml, 'CondicionIVAReceptorId')) {
    return resp('<Errors><Err><Code>10246</Code><Msg>El campo Condicion Frente al IVA del receptor es obligatorio conforme RG 5616</Msg></Err></Errors>');
  }
  const ultimo = e.ultimos.get(`${pv}-${tipo}`) ?? 0;
  if (nro !== ultimo + 1) return obs('10016', 'El numero o fecha del comprobante no se corresponde con el proximo a autorizar.');
  const n = (t: string) => Number(tag(xml, t) ?? 0);
  const suma = n('ImpTotConc') + n('ImpNeto') + n('ImpOpEx') + n('ImpTrib') + n('ImpIVA');
  if (Math.abs(suma - n('ImpTotal')) > 0.01) return obs('10048', 'El campo ImpTotal debe ser igual a la suma de ImpTotConc + ImpNeto + ImpOpEx + ImpTrib + ImpIVA.');
  const alic = [...xml.matchAll(/<(?:\w+:)?AlicIva>([\s\S]*?)<\/(?:\w+:)?AlicIva>/g)].map(m => m[1]);
  const ivaSum = alic.reduce((a, b) => a + Number(tag(b, 'Importe')), 0);
  if (Math.abs(ivaSum - n('ImpIVA')) > 0.01) return obs('10018', 'La suma de los importes de IVA no coincide con ImpIVA.');
  if ([2, 3, 7, 8].includes(tipo) && !xml.includes('CbteAsoc>')) return obs('10197', 'Las notas de credito y debito requieren comprobante asociado.');

  e.ultimos.set(`${pv}-${tipo}`, nro);
  const cae = String(76000000000000 + nro * 7 + pv);
  const vto = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10).replace(/-/g, '');
  e.emitidos.set(`${pv}-${tipo}-${nro}`, {
    Concepto: tag(xml, 'Concepto')!, DocTipo: tag(xml, 'DocTipo')!, DocNro: tag(xml, 'DocNro')!,
    CbteDesde: String(nro), CbteHasta: String(nro), CbteFch: tag(xml, 'CbteFch')!, ImpTotal: tag(xml, 'ImpTotal')!,
    CodAutorizacion: cae, EmisionTipo: 'CAE', FchVto: vto, Resultado: 'A', PtoVta: String(pv), CbteTipo: String(tipo),
  });
  return det('A', `<CAE>${cae}</CAE><CAEFchVto>${vto}</CAEFchVto>`);
}

// Personas del padrón simulado (respuesta de getPersona_v2 tal como la arma ARCA).
const PADRON: Record<string, string> = {
  '30700000008':
    `<datosGenerales><domicilioFiscal><codPostal>3600</codPostal><descripcionProvincia>FORMOSA</descripcionProvincia>` +
    `<direccion>AV 25 DE MAYO 1234</direccion><idProvincia>9</idProvincia><localidad>FORMOSA</localidad>` +
    `<tipoDomicilio>FISCAL</tipoDomicilio></domicilioFiscal><estadoClave>ACTIVO</estadoClave><idPersona>30700000008</idPersona>` +
    `<mesCierre>12</mesCierre><razonSocial>CONSTRUCTORA DEL NORTE S.A.</razonSocial><tipoClave>CUIT</tipoClave>` +
    `<tipoPersona>JURIDICA</tipoPersona></datosGenerales><datosRegimenGeneral>` +
    `<actividad><descripcionActividad>CONSTRUCCIÓN DE EDIFICIOS RESIDENCIALES</descripcionActividad><idActividad>410011</idActividad><orden>1</orden><periodo>201501</periodo></actividad>` +
    `<impuesto><descripcionImpuesto>GANANCIAS SOCIEDADES</descripcionImpuesto><idImpuesto>10</idImpuesto><periodo>201501</periodo></impuesto>` +
    `<impuesto><descripcionImpuesto>IVA</descripcionImpuesto><idImpuesto>30</idImpuesto><periodo>201501</periodo></impuesto>` +
    `</datosRegimenGeneral>`,
  '27288887778':
    `<datosGenerales><apellido>GOMEZ</apellido><domicilioFiscal><codPostal>3600</codPostal>` +
    `<descripcionProvincia>FORMOSA</descripcionProvincia><direccion>PADRE PATIÑO 850</direccion><localidad>FORMOSA</localidad>` +
    `</domicilioFiscal><estadoClave>ACTIVO</estadoClave><idPersona>27288887778</idPersona><nombre>MARIA DE LOS ANGELES</nombre>` +
    `<tipoClave>CUIT</tipoClave><tipoPersona>FISICA</tipoPersona></datosGenerales>` +
    `<datosMonotributo><categoriaMonotributo><descripcionCategoria>D LOCACIONES DE SERVICIO</descripcionCategoria>` +
    `<idCategoria>13</idCategoria></categoriaMonotributo><impuesto><descripcionImpuesto>MONOTRIBUTO</descripcionImpuesto>` +
    `<idImpuesto>20</idImpuesto></impuesto></datosMonotributo>`,
  '20333333334':
    `<errorConstancia><apellido>PEREZ</apellido><error>El contribuyente no posee impuestos activos</error>` +
    `<idPersona>20333333334</idPersona><nombre>JUAN CARLOS</nombre></errorConstancia>`,
};

function manejarPadron(xml: string, e: EstadoFake): string {
  if (!tag(xml, 'token')?.startsWith('TOKEN-')) return fault('Server', 'token invalido');
  const id = tag(xml, 'idPersona') ?? '';
  const persona = PADRON[id];
  if (!persona) return fault('Server', 'No existe persona con ese Id');
  e.llamadas.push(`padron:${id}`);
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><ns2:getPersona_v2Response xmlns:ns2="http://a5.soap.ws.server.puc.sr/"><personaReturn>${persona}` +
    `<metadata><fechaHora>2026-10-02T10:00:00-03:00</fechaHora><servidor>fake</servidor></metadata>` +
    `</personaReturn></ns2:getPersona_v2Response></soap:Body></soap:Envelope>`;
}

export async function iniciarArcaFake(): Promise<{ url: string; estado: EstadoFake; cerrar: () => Promise<void> }> {
  const estado: EstadoFake = {
    logins: 0, llamadas: [], ultimos: new Map(), puntosVenta: [{ nro: 3, tipo: 'CAE - RECE' }], demora: {}, errores: {},
    demoraDespues: {}, emitidos: new Map(), ultimoAtrasado: 0, tragar: new Set(),
    caido: false, caeas: new Map(), sinMovimiento: [],
  };
  const server = http.createServer((req, res) => {
    const partes: Buffer[] = [];
    req.on('data', c => partes.push(c));
    req.on('end', async () => {
      const xml = Buffer.concat(partes).toString('utf8');
      const servicio = req.url?.split('/')[1] ?? '';
      const metodo = servicio === 'wsaa' ? 'loginCms'
        : String(req.headers.soapaction ?? '').replace(/"/g, '').replace(/^.*\//, '');
      estado.llamadas.push(metodo);
      if (estado.tragar.has(metodo)) { estado.tragar.delete(metodo); setTimeout(() => req.socket.destroy(), 1500); return; }
      const demora = estado.demora[metodo];
      if (demora) { delete estado.demora[metodo]; await new Promise(r => setTimeout(r, demora)); }
      if (estado.caido && servicio === 'wsfe' && !metodo.startsWith('FECAEA')) {
        res.writeHead(503, { 'Content-Type': 'text/html' }); res.end('<html>Service Unavailable</html>'); return;
      }
      const cuerpo = servicio === 'wsaa' ? manejarWsaa(xml, estado)
        : servicio === 'padron' ? manejarPadron(xml, estado)
        : manejarWsfe(metodo, xml, estado);
      const despues = estado.demoraDespues[metodo];
      if (despues) { delete estado.demoraDespues[metodo]; await new Promise(r => setTimeout(r, despues)); }
      res.writeHead(cuerpo.includes('Fault>') ? 500 : 200, { 'Content-Type': 'text/xml; charset=utf-8' });
      res.end(cuerpo);
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`, estado,
    cerrar: () => new Promise(r => { server.closeAllConnections(); server.close(() => r()); }),
  };
}

/** Firma un CSR con una CA de prueba: simula el .crt que entrega ARCA. */
export function emitirCertificadoDePrueba(csrPem: string, diasVigencia = 730): string {
  const ca = forge.pki.rsa.generateKeyPair(1024);
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey!;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + diasVigencia * 86400_000);
  cert.setSubject(csr.subject.attributes);
  cert.setIssuer([{ name: 'commonName', value: 'Computadores Test (ARCA fake)' }]);
  cert.sign(ca.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}
