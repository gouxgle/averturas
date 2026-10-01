-- Changelog: Renovar validez de precios eligiendo productos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Renovar validez de precios eligiendo productos', 'En Productos > Renovar validez de precios se suma la opción Elegir productos: se buscan por nombre, código o proveedor, se filtran por familia, proveedor o estado del precio (vencidos, por vencer, al día), se marcan a mano o todos los de la lista, y se renueva solo la fecha de esos productos. También sirve para los productos sin familia.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261001000007_changelog_renovar_validez_de_precios_eligiendo_pro.sql') ON CONFLICT DO NOTHING;
