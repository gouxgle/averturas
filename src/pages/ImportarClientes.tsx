import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle2, AlertCircle, XCircle, ArrowLeft, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ClienteRow {
  tipo_persona: string;
  nombre: string;
  apellido: string;
  razon_social: string;
  telefono: string;
  telefono_fijo: string;
  email: string;
  notas: string;
  categoria: string;
  origen: string;
}

interface ImportResult {
  importados: number;
  duplicados: number;
  errores: number;
  detalleErrores: { fila: number; nombre: string; error: string }[];
}

function parseCSV(text: string): ClienteRow[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detectar separador
  const sep = lines[0].includes(';') ? ';' : ',';

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let inQuote = false;
    let cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === sep && !inQuote) { result.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z_]/g, ''));
  const rows: ClienteRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    if (vals.every(v => !v)) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ''; });
    rows.push({
      tipo_persona: obj.tipo_persona || 'fisica',
      nombre:       obj.nombre || '',
      apellido:     obj.apellido || '',
      razon_social: obj.razon_social || '',
      telefono:     obj.telefono || '',
      telefono_fijo: obj.telefono_fijo || '',
      email:        obj.email || '',
      notas:        obj.notas || '',
      categoria:    obj.categoria || '',
      origen:       obj.origen || 'importacion',
    });
  }
  return rows;
}

const PAGE_SIZE = 50;

export function ImportarClientes() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows]           = useState<ClienteRow[]>([]);
  const [fileName, setFileName]   = useState('');
  const [page, setPage]           = useState(0);
  const [dragging, setDragging]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<ImportResult | null>(null);

  function loadFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .csv');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setFileName(file.name);
      setPage(0);
      setResult(null);
      if (parsed.length === 0) toast.error('No se encontraron registros en el archivo');
      else toast.success(`${parsed.length} filas cargadas`);
    };
    reader.readAsText(file, 'utf-8');
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  async function handleImport() {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await api.post<ImportResult>('/clientes/importar', rows);
      setResult(res);
      if (res.importados > 0) toast.success(`${res.importados} clientes importados`);
      if (res.errores > 0)    toast.error(`${res.errores} errores`);
    } catch {
      toast.error('Error en la importación');
    } finally {
      setImporting(false);
    }
  }

  function downloadPlantilla() {
    const header = 'tipo_persona,nombre,apellido,razon_social,telefono,telefono_fijo,email,notas,origen';
    const example = 'fisica,Juan,Pérez,,5493704123456,,juan@mail.com,,importacion';
    const blob = new Blob([header + '\n' + example], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_clientes.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clientes')}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Importar clientes</h1>
          <p className="text-sm text-slate-500">Cargá un CSV y revisá los datos antes de importar</p>
        </div>
        <div className="ml-auto">
          <button onClick={downloadPlantilla}
            className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
            <Download size={14} />
            Descargar plantilla
          </button>
        </div>
      </div>

      {/* Dropzone */}
      {!rows.length && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
          <Upload size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-600 font-medium">Arrastrá el CSV aquí o hacé click para seleccionarlo</p>
          <p className="text-sm text-slate-400 mt-1">
            Formato esperado: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">tipo_persona, nombre, apellido, razon_social, telefono, email, notas</code>
          </p>
        </div>
      )}

      {/* Archivo cargado + preview */}
      {rows.length > 0 && !result && (
        <>
          {/* Info del archivo */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <FileText size={18} className="text-blue-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">{fileName}</p>
              <p className="text-xs text-blue-500">{rows.length} registros listos para revisar</p>
            </div>
            <button onClick={() => { setRows([]); setFileName(''); setPage(0); }}
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-400 transition-colors">
              <XCircle size={16} />
            </button>
          </div>

          {/* Tabla preview */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Teléfono</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pageRows.map((r, idx) => {
                    const nombre = [r.apellido, r.nombre].filter(Boolean).join(', ') || r.razon_social || '—';
                    const n = page * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={n} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{n}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{nombre}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.tipo_persona === 'juridica' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.tipo_persona === 'juridica' ? 'Jurídica' : 'Física'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{r.telefono || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{r.email || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{r.categoria || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[180px] truncate">{r.notas || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">
                  Página {page + 1} de {totalPages} ({rows.length} registros)
                </span>
                <div className="flex gap-2">
                  <button disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 disabled:opacity-40 hover:bg-white transition-colors">
                    Anterior
                  </button>
                  <button disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 disabled:opacity-40 hover:bg-white transition-colors">
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Revisá los datos arriba. Los duplicados (mismo teléfono) se omitirán automáticamente.
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {importing ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</>
              ) : (
                <><Upload size={16} />Importar {rows.length} clientes</>
              )}
            </button>
          </div>
        </>
      )}

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-3xl font-bold text-emerald-700">{result.importados}</p>
              <p className="text-sm text-emerald-600 mt-0.5">Importados</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
              <AlertCircle size={28} className="mx-auto mb-2 text-amber-500" />
              <p className="text-3xl font-bold text-amber-700">{result.duplicados}</p>
              <p className="text-sm text-amber-600 mt-0.5">Duplicados omitidos</p>
            </div>
            <div className={`border rounded-2xl p-5 text-center ${result.errores > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
              <XCircle size={28} className={`mx-auto mb-2 ${result.errores > 0 ? 'text-red-500' : 'text-slate-300'}`} />
              <p className={`text-3xl font-bold ${result.errores > 0 ? 'text-red-700' : 'text-slate-400'}`}>{result.errores}</p>
              <p className={`text-sm mt-0.5 ${result.errores > 0 ? 'text-red-600' : 'text-slate-400'}`}>Errores</p>
            </div>
          </div>

          {result.detalleErrores.length > 0 && (
            <div className="bg-white border border-red-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                <p className="text-sm font-semibold text-red-700">Detalle de errores</p>
              </div>
              <div className="divide-y divide-red-50">
                {result.detalleErrores.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 flex gap-4 text-sm">
                    <span className="text-red-400 font-mono shrink-0">Fila {e.fila}</span>
                    <span className="font-medium text-slate-700 shrink-0">{e.nombre}</span>
                    <span className="text-red-600 truncate">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => navigate('/clientes')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Ver clientes
            </button>
            <button onClick={() => { setRows([]); setFileName(''); setResult(null); }}
              className="border border-slate-200 text-slate-700 font-medium px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
              Importar otro archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
