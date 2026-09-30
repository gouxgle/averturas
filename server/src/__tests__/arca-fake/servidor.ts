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
      return resp(`<PtoVta>${pv}</PtoVta><CbteTipo>${tipo}</CbteTipo><CbteNro>${e.ultimos.get(`${pv}-${tipo}`) ?? 0}</CbteNro>`);
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
    case 'FECompConsultar':
      return resp('<Errors><Err><Code>602</Code><Msg>No existen datos en nuestros registros para los parametros ingresados.</Msg></Err></Errors>');
    default:
      return fault('Client', `Método no simulado: ${metodo}`);
  }
}

export async function iniciarArcaFake(): Promise<{ url: string; estado: EstadoFake; cerrar: () => Promise<void> }> {
  const estado: EstadoFake = {
    logins: 0, llamadas: [], ultimos: new Map(), puntosVenta: [{ nro: 3, tipo: 'CAE - RECE' }], demora: {}, errores: {},
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
      const demora = estado.demora[metodo];
      if (demora) { delete estado.demora[metodo]; await new Promise(r => setTimeout(r, demora)); }
      const cuerpo = servicio === 'wsaa' ? manejarWsaa(xml, estado) : manejarWsfe(metodo, xml, estado);
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
