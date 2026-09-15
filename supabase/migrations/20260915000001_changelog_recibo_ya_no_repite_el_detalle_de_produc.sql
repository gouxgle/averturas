-- Changelog: Recibo: ya no repite el detalle de productos de la proforma
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Recibo: ya no repite el detalle de productos de la proforma', 'El PDF del recibo (modal y el que se envía por WhatsApp) mostraba una tabla con los ítems del presupuesto que, en un pago parcial, sumaba más que lo cobrado — podía leerse como si el cliente hubiera pagado esos importes. Se reemplaza por una referencia clara: ''Detalle de proforma: PRO-XXXXX — Rev. N'', dejando el desglose de productos donde corresponde, en la proforma. De paso, tanto esa referencia como el concepto autogenerado y la línea ''Ref. presupuesto'' del encabezado pasan a usar el número PRO- (el que ve el cliente en la proforma) en vez del número interno OP-.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20260915000001_changelog_recibo_ya_no_repite_el_detalle_de_produc.sql') ON CONFLICT DO NOTHING;
