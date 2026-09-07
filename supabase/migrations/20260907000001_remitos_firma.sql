-- Firma digital de conformidad al entregar, capturada en el celular de quien
-- entrega — mismo patrón que visitas_tecnicas.firma_url (canvas → PNG → subida →
-- URL guardada como texto plano). Se completa desde PATCH /remitos/:id/estado al
-- marcar "entregado" (ver ModalEstado en Remitos.tsx), no es obligatoria.
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS firma_url TEXT;

INSERT INTO schema_migrations (filename) VALUES ('20260907000001_remitos_firma.sql') ON CONFLICT DO NOTHING;
