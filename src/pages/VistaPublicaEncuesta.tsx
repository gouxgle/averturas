import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Estrellas } from '@/components/postventa/Estrellas';

const NAVY = '#031d49';

interface Datos {
  empresa: { nombre: string; telefono: string | null; logo_url: string | null; instagram: string | null } | null;
  cliente: string | null; productos: string[]; respondida: boolean;
}

const PREGUNTAS = [
  { k: 'puntaje_productos', t: '¿Qué te parecieron los productos?', s: 'Calidad, terminación, funcionamiento' },
  { k: 'puntaje_entrega', t: '¿Cómo fue la entrega y la instalación?', s: 'Puntualidad, cuidado, prolijidad' },
  { k: 'puntaje_atencion', t: '¿Cómo fue la atención en la venta?', s: 'Asesoramiento, presupuesto, trato' },
] as const;

type Clave = typeof PREGUNTAS[number]['k'];

// Encuesta post venta que recibe el cliente por WhatsApp (/e/:token): tres notas de 1 a 5 y un comentario.
export function VistaPublicaEncuesta() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'invalido' | 'enviada'>('cargando');
  const [p, setP] = useState<Record<Clave, number | null>>({ puntaje_productos: null, puntaje_entrega: null, puntaje_atencion: null });
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/pub/encuesta/${token}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Datos) => { setDatos(d); setEstado(d.respondida ? 'enviada' : 'listo'); })
      .catch(() => setEstado('invalido'));
  }, [token]);

  const completa = PREGUNTAS.every(q => p[q.k]);
  async function enviar() {
    if (!completa || enviando) return;
    setEnviando(true); setError('');
    try {
      const r = await fetch(`/api/pub/encuesta/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, comentario: comentario.trim() || undefined }),
      });
      if (!r.ok) throw new Error();
      setEstado('enviada');
    } catch { setError('No se pudo enviar. Probá de nuevo en un momento.'); } finally { setEnviando(false); }
  }

  const empresa = datos?.empresa;
  return (
    <div className="min-h-[100dvh] bg-slate-100 flex justify-center px-4 py-6" data-testid="encuesta-publica">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 text-white flex items-center gap-3" style={{ backgroundColor: NAVY }}>
            {empresa?.logo_url && <img src={empresa.logo_url} alt="" className="h-10 w-auto bg-white rounded-lg p-1" />}
            <p className="font-bold leading-tight">{empresa?.nombre ?? 'Tu opinión nos importa'}</p>
          </div>

          {estado === 'cargando' && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}
          {estado === 'invalido' && (
            <div className="p-6 text-center space-y-2">
              <p className="font-bold text-gray-900">Este link no está disponible</p>
              <p className="text-sm text-gray-600">Venció o ya no es válido. Si querés contarnos tu experiencia, escribinos{empresa?.telefono ? ` al ${empresa.telefono}` : ''}.</p>
            </div>
          )}
          {estado === 'enviada' && (
            <div className="p-8 text-center space-y-3">
              <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
              <p className="text-lg font-bold text-gray-900">¡Muchas gracias!</p>
              <p className="text-sm text-gray-600">Tu opinión nos ayuda a mejorar. Si necesitás algo más, estamos a tu disposición.</p>
            </div>
          )}
          {estado === 'listo' && datos && (
            <div className="p-5 space-y-5">
              <div>
                <p className="text-lg font-bold text-gray-900">Hola{datos.cliente ? `, ${datos.cliente}` : ''} 👋</p>
                <p className="text-sm text-gray-600 mt-1">
                  Queremos saber cómo te fue con {datos.productos.length ? <b>{datos.productos.slice(0, 3).join(', ').toLowerCase()}{datos.productos.length > 3 ? ' y más' : ''}</b> : 'tu pedido'}. Son solo tres preguntas.
                </p>
              </div>
              {PREGUNTAS.map(q => (
                <div key={q.k}>
                  <p className="text-sm font-bold text-gray-900">{q.t}</p>
                  <p className="text-xs text-gray-500 mb-1">{q.s}</p>
                  <Estrellas value={p[q.k]} onChange={v => setP(prev => ({ ...prev, [q.k]: v }))} tam={22} etiqueta={q.t} />
                  <div className="flex justify-between text-[11px] text-gray-400 px-1 max-w-[16rem]"><span>Muy mal</span><span>Excelente</span></div>
                </div>
              ))}
              <label className="block text-sm font-bold text-gray-900">¿Algo para contarnos? <span className="font-normal text-gray-500">(opcional)</span>
                <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} maxLength={1000}
                  className="mt-1 w-full rounded-xl border border-gray-300 p-3 text-base font-normal focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </label>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <button type="button" onClick={enviar} disabled={!completa || enviando} data-testid="encuesta-enviar"
                className="w-full h-12 rounded-xl text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2" style={{ backgroundColor: NAVY }}>
                {enviando && <Loader2 size={16} className="animate-spin" />} Enviar mi opinión
              </button>
              {!completa && <p className="text-xs text-center text-gray-500 -mt-3">Calificá las tres preguntas para enviar.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
