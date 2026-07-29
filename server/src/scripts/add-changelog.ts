/**
 * Genera una migración chica que solo inserta una fila en changelog_cambios.
 * Uso: npm run changelog:add -- "Título" ["Descripción"] [feature|fix|mejora]
 *
 * Se aplica con el `npm run migrate` normal — no requiere ningún paso extra
 * al deployar, viaja con el resto de las migraciones de la feature.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [, , titulo, descripcion, categoriaArg] = process.argv;

if (!titulo?.trim()) {
  console.error('Uso: npm run changelog:add -- "Título" ["Descripción"] [feature|fix|mejora]');
  process.exit(1);
}

const CATEGORIAS = ['feature', 'fix', 'mejora'] as const;
const categoria = CATEGORIAS.includes(categoriaArg as typeof CATEGORIAS[number]) ? categoriaArg : 'mejora';

const MIGRATIONS_DIR = resolve(process.env.MIGRATIONS_DIR ?? join(process.cwd(), '../supabase/migrations'));

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function slug(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

function nextFilename(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const existentes = readdirSync(MIGRATIONS_DIR).filter(f => f.startsWith(today));
  const nums = existentes.map(f => parseInt(f.slice(8, 14), 10)).filter(n => !isNaN(n));
  const siguiente = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${today}${String(siguiente).padStart(6, '0')}_changelog_${slug(titulo)}.sql`;
}

const filename = nextFilename();
const sql = `-- Changelog: ${titulo}
INSERT INTO changelog_cambios (fecha, titulo, descripcion, categoria) VALUES
  (CURRENT_DATE, '${sqlEscape(titulo.trim())}', ${descripcion?.trim() ? `'${sqlEscape(descripcion.trim())}'` : 'NULL'}, '${categoria}');

INSERT INTO schema_migrations (filename) VALUES ('${filename}') ON CONFLICT DO NOTHING;
`;

writeFileSync(join(MIGRATIONS_DIR, filename), sql);
console.log(`✅ Creado supabase/migrations/${filename}`);
console.log('   Corré "npm run migrate" para aplicarlo local. Se deployará solo con el próximo git pull + migrate en test/prod.');
