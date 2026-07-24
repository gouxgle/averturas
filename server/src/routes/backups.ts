import { Hono } from 'hono';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';

const backups = new Hono();

const LOG_PATH = '/app/backup-log/backup-aberturas.log';
const DATA_DIR = '/app/backup-data';

interface Corrida {
  fecha: string;              // ISO
  exitoso: boolean;
  archivo: string | null;
  error: string | null;
}

// Parsea el log de texto plano del script de backup (no requiere tocar el script).
// Formato por corrida:
//   [YYYY-MM-DD HH:MM:SS] Iniciando backup aberturas...
//   [YYYY-MM-DD HH:MM:SS] Subiendo a Google Drive...
//   ... (línea de rclone si falla, ej "CRITICAL: ...") ...
//   [YYYY-MM-DD HH:MM:SS] Backup completado: archivo.sql.gz   ← solo si tuvo éxito
function parsearLog(contenido: string): Corrida[] {
  const lineas = contenido.split('\n').filter(l => l.trim());
  const corridas: Corrida[] = [];
  let actual: Corrida | null = null;

  for (const linea of lineas) {
    const mInicio = linea.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] Iniciando backup/);
    if (mInicio) {
      if (actual) corridas.push(actual);
      actual = { fecha: mInicio[1].replace(' ', 'T'), exitoso: false, archivo: null, error: null };
      continue;
    }
    if (!actual) continue;

    const mCompletado = linea.match(/Backup completado: (\S+)/);
    if (mCompletado) {
      actual.exitoso = true;
      actual.archivo = mCompletado[1];
      continue;
    }
    const mErrorPgdump = linea.match(/ERROR: pg_dump falló/);
    if (mErrorPgdump) {
      actual.error = 'pg_dump falló';
      continue;
    }
    // Líneas de rclone (no siguen el formato "[fecha] texto" del script) → error de subida
    if (!actual.exitoso && /CRITICAL|ERROR/i.test(linea) && !linea.startsWith('[')) {
      actual.error = linea.trim().slice(0, 300);
    }
  }
  if (actual) corridas.push(actual);

  return corridas.reverse(); // más reciente primero
}

backups.get('/', async (c) => {
  const user = c.get('user');
  if (user.rol !== 'admin') return c.json({ error: 'Sin permisos' }, 403);

  let corridas: Corrida[] = [];
  let logDisponible = false;
  try {
    if (existsSync(LOG_PATH) && statSync(LOG_PATH).isFile()) {
      corridas = parsearLog(readFileSync(LOG_PATH, 'utf-8')).slice(0, 60);
      logDisponible = true;
    }
  } catch { /* sin log disponible (ej. local/test) */ }

  let archivosLocales: { nombre: string; tamano_bytes: number; fecha: string }[] = [];
  try {
    if (existsSync(DATA_DIR) && statSync(DATA_DIR).isDirectory()) {
      archivosLocales = readdirSync(DATA_DIR)
        .filter(f => f.endsWith('.sql.gz'))
        .map(f => {
          const s = statSync(`${DATA_DIR}/${f}`);
          return { nombre: f, tamano_bytes: s.size, fecha: s.mtime.toISOString() };
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
    }
  } catch { /* sin directorio disponible */ }

  const ultimoExitoso = corridas.find(r => r.exitoso) ?? null;
  const hace7dias = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const ultimos7dias = corridas.filter(r => new Date(r.fecha).getTime() >= hace7dias);
  const fallosUltimos7dias = ultimos7dias.filter(r => !r.exitoso).length;
  const espacioLocalBytes = archivosLocales.reduce((acc, a) => acc + a.tamano_bytes, 0);
  const diasSinExito = ultimoExitoso
    ? Math.floor((Date.now() - new Date(ultimoExitoso.fecha).getTime()) / 86_400_000)
    : null;

  return c.json({
    disponible: logDisponible || archivosLocales.length > 0,
    corridas,
    archivos_locales: archivosLocales,
    resumen: {
      ultimo_exitoso_at: ultimoExitoso?.fecha ?? null,
      dias_desde_ultimo_exitoso: diasSinExito,
      fallos_ultimos_7_dias: fallosUltimos7dias,
      corridas_ultimos_7_dias: ultimos7dias.length,
      espacio_local_bytes: espacioLocalBytes,
      cantidad_archivos_locales: archivosLocales.length,
    },
  });
});

export default backups;
