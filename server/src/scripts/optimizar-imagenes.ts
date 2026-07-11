// Backfill: convierte a WebP y redimensiona las imágenes de productos ya
// subidas (fotos de celular guardadas como PNG/JPG comprimen muy mal —
// convertir a WebP da ~90-95% de reducción en fotos reales).
// Actualiza catalogo_productos.imagen_url e imagenes con el nuevo nombre.
//
// Uso:
//   node dist/scripts/optimizar-imagenes.js [dir] --dry-run   (solo muestra qué haría)
//   node dist/scripts/optimizar-imagenes.js [dir]              (ejecuta de verdad)
import { readdir, stat, readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';
import pkg from 'pg';
const { Pool } = pkg;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dir = args.find(a => !a.startsWith('--')) ?? './uploads/productos';
const MAX_SIDE = 1600;
const SKIP_UNDER_BYTES = 300 * 1024; // ya optimizadas (subidas nuevas)

const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });

async function main() {
  const files = (await readdir(dir)).filter(f => /\.(jpe?g|png)$/i.test(f)); // webp ya optimizado, se saltea
  console.log(`Encontrados ${files.length} archivos JPG/PNG en ${dir}${dryRun ? ' [DRY RUN]' : ''}`);

  const backupDir = join(dir, '_backup_original');
  if (!dryRun) await mkdir(backupDir, { recursive: true });

  let totalAntes = 0, totalDespues = 0, procesados = 0, saltados = 0, sinReferenciaDb = 0;

  for (const file of files) {
    const filePath = join(dir, file);
    const st = await stat(filePath);
    if (!st.isFile()) continue;
    const pesoAntes = st.size;

    if (pesoAntes < SKIP_UNDER_BYTES) { saltados++; continue; }

    const webpName = basename(file, extname(file)) + '.webp';
    const webpPath = join(dir, webpName);
    const oldUrl = `/uploads/productos/${file}`;
    const newUrl = `/uploads/productos/${webpName}`;

    const buf = await readFile(filePath);
    const out = await sharp(buf)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    console.log(`  ${file} -> ${webpName}: ${(pesoAntes/1024).toFixed(0)}KB -> ${(out.length/1024).toFixed(0)}KB`);

    if (dryRun) {
      const { rows } = await db.query(
        `SELECT id, nombre FROM catalogo_productos WHERE imagen_url = $1 OR imagenes::text LIKE '%' || $1 || '%'`,
        [oldUrl]
      );
      console.log(`    referenciada por ${rows.length} producto(s): ${rows.map((r: any) => r.nombre).join(', ') || '(ninguno — huérfana)'}`);
      if (rows.length === 0) sinReferenciaDb++;
    } else {
      await writeFile(webpPath, out);

      const res1 = await db.query(
        `UPDATE catalogo_productos SET imagen_url = $2 WHERE imagen_url = $1`,
        [oldUrl, newUrl]
      );
      const res2 = await db.query(
        `UPDATE catalogo_productos
         SET imagenes = to_jsonb(replace(imagenes::text, $1, $2))::jsonb
         WHERE imagenes::text LIKE '%' || $1 || '%'`,
        [oldUrl, newUrl]
      );
      if ((res1.rowCount ?? 0) === 0 && (res2.rowCount ?? 0) === 0) sinReferenciaDb++;

      await copyFile(filePath, join(backupDir, file));
      await rm(filePath);
    }

    totalAntes += pesoAntes;
    totalDespues += out.length;
    procesados++;
  }

  console.log(`\nProcesados: ${procesados} | Saltados (ya chicos): ${saltados} | Sin referencia en DB: ${sinReferenciaDb}`);
  console.log(`Antes: ${(totalAntes/1024/1024).toFixed(2)}MB | Después: ${(totalDespues/1024/1024).toFixed(2)}MB`);
  if (!dryRun) console.log(`Originales movidos a: ${backupDir}`);
}

main().then(() => db.end()).catch(err => { console.error('Error:', err); db.end(); process.exit(1); });
