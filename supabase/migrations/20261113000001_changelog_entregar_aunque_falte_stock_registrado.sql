-- Changelog: Entregar aunque falte stock registrado
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, 'Entregar aunque falte stock registrado', 'Al armar un remito se avisa qué productos no tienen stock registrado y se puede cargar el ingreso ahí mismo. Si al entregar sigue faltando, Entregar igual registra la entrega con la firma y deja en la Agenda un recordatorio de prioridad alta para revisar el stock.', 'mejora');

INSERT INTO schema_migrations (filename) VALUES ('20261113000001_changelog_entregar_aunque_falte_stock_registrado.sql') ON CONFLICT DO NOTHING;
