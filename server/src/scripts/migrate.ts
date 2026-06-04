/**
 * Migration runner — aplica migraciones SQL pendientes en orden.
 *
 * Uso:
 *   npm run migrate           → aplica pendientes
 *   npm run migrate -- --dry  → muestra qué aplicaría sin ejecutar
 *   npm run migrate -- --list → lista todas con su estado
 *
 * Las migraciones se leen de supabase/migrations/ (accesibles en /migrations/ dentro del contenedor).
 * El estado se guarda en la tabla schema_migrations.
 */

import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// ── Paths ──────────────────────────────────────────────────────
// Funciona tanto en dev local (desde server/) como en contenedor (/app/)
const MIGRATIONS_DIR = resolve(
  process.env.MIGRATIONS_DIR ??
  join(process.cwd(), '../supabase/migrations')
);

// ── DB ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function ensureMigrationsTable(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getApplied(client: pg.PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(rows.map(r => r.filename));
}

async function getMigrationFiles(): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(MIGRATIONS_DIR);
  } catch {
    console.error(`❌ No se encontró el directorio de migraciones: ${MIGRATIONS_DIR}`);
    console.error('   Verificá que MIGRATIONS_DIR esté configurado correctamente.');
    process.exit(1);
  }
  return files
    .filter(f => f.endsWith('.sql'))
    .sort(); // orden cronológico por nombre (YYYYMMDDNNNNNN_)
}

// ── Comandos ───────────────────────────────────────────────────
async function listMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const files   = await getMigrationFiles();

    console.log('\nMigraciones:');
    for (const file of files) {
      const status = applied.has(file) ? '✅ aplicada' : '⏳ pendiente';
      console.log(`  ${status}  ${file}`);
    }
    const pending = files.filter(f => !applied.has(f));
    console.log(`\nTotal: ${files.length} | Aplicadas: ${applied.size} | Pendientes: ${pending.length}\n`);
  } finally {
    client.release();
  }
}

async function runMigrations(dry = false) {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const files   = await getMigrationFiles();
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅ Sin migraciones pendientes.');
      return;
    }

    console.log(`\n${dry ? '[DRY RUN] ' : ''}Migraciones pendientes: ${pending.length}`);

    for (const file of pending) {
      const filepath = join(MIGRATIONS_DIR, file);
      const sql = await readFile(filepath, 'utf-8');

      if (dry) {
        console.log(`  → ${file} (dry run, no ejecutado)`);
        continue;
      }

      console.log(`  → Aplicando ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        // Registrar como aplicada (el SQL propio ya hace INSERT, pero lo garantizamos acá)
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file]
        );
        await client.query('COMMIT');
        console.log(`     ✅ OK`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`     ❌ Error en ${file}:`);
        console.error(`     ${(err as Error).message}`);
        console.error('\n⚠️  Migración abortada. Las anteriores ya fueron aplicadas.');
        process.exit(1);
      }
    }

    if (!dry) console.log('\n✅ Todas las migraciones aplicadas.\n');
  } finally {
    client.release();
  }
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--list')) {
      await listMigrations();
    } else {
      const dry = args.includes('--dry');
      await runMigrations(dry);
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Error inesperado:', err.message);
  process.exit(1);
});
