// QR obligatorio de la RG 4892: URL de ARCA con los datos del comprobante en JSON base64.
// Al escanearlo, ARCA muestra si el comprobante existe y coincide. La URL es la de la
// especificación (dominio afip.gob.ar), que ARCA sigue atendiendo.

export interface DatosQR {
  fecha: string; cuit: string; ptoVta: number; tipoCmp: number; nroCmp: number; importe: number;
  moneda: string; ctz: number; tipoDocRec: number; nroDocRec: string; tipoCodAut: 'E' | 'A'; codAut: string;
}

export function urlQR(d: DatosQR): string {
  const json = {
    ver: 1, fecha: d.fecha, cuit: Number(d.cuit), ptoVta: d.ptoVta, tipoCmp: d.tipoCmp, nroCmp: d.nroCmp,
    importe: d.importe, moneda: d.moneda, ctz: d.ctz,
    ...(d.tipoDocRec !== 99 ? { tipoDocRec: d.tipoDocRec, nroDocRec: Number(d.nroDocRec) } : {}),
    tipoCodAut: d.tipoCodAut, codAut: Number(d.codAut),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(json)).toString('base64')}`;
}
