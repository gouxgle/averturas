// URLs oficiales de ARCA por ambiente. ARCA_FAKE_URL (solo tests / desarrollo) manda todos
// los servicios al servidor simulado de server/src/__tests__/arca-fake.
export type Ambiente = 'homologacion' | 'produccion';
export type ServicioArca = 'wsaa' | 'wsfe' | 'padron';

const URLS: Record<Ambiente, Record<ServicioArca, string>> = {
  homologacion: {
    wsaa:   'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe:   'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
  produccion: {
    wsaa:   'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe:   'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
    padron: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  },
};

// Nombre del servicio tal como se pide el ticket en WSAA.
export const SERVICIO_WSAA: Record<Exclude<ServicioArca, 'wsaa'>, string> = {
  wsfe:   'wsfe',
  padron: 'ws_sr_constancia_inscripcion',
};

export function urlServicio(ambiente: Ambiente, servicio: ServicioArca): string {
  const fake = process.env.ARCA_FAKE_URL;
  if (fake) return `${fake.replace(/\/$/, '')}/${servicio}`;
  return URLS[ambiente][servicio];
}
