-- Changelog: Color identificatorio por proveedor en los productos
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Color identificatorio por proveedor en los productos', 'Cada proveedor ahora tiene un color propio, que se elige desde una paleta al cargarlo o editarlo. Ese color aparece en cada producto asociado — como franja en la tarjeta y como etiqueta con el nombre del proveedor — en el catálogo, Venta Rápida, Existencias y los buscadores de producto de Presupuesto, Remito y Pedido, para distinguir de un vistazo de quién es cada producto al ver varios juntos. Los proveedores que todavía no eligieron color usan uno automático estable, así la función sirve desde el primer momento sin tener que editarlos uno por uno.', 'feature');

INSERT INTO schema_migrations (filename) VALUES ('20260901000001_changelog_color_identificatorio_por_proveedor_en_l.sql') ON CONFLICT DO NOTHING;
