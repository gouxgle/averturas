import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

// ── Pronóstico del tiempo (Open-Meteo, Formosa AR) ───────────────────

const WMO_EMOJI: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const WMO_DESC: Record<number, string> = {
  0: 'Despejado', 1: 'Principalmente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla',
  51: 'Llovizna leve', 53: 'Llovizna', 55: 'Llovizna intensa',
  61: 'Lluvia leve', 63: 'Lluvia', 65: 'Lluvia intensa',
  71: 'Nieve leve', 73: 'Nieve', 75: 'Nieve intensa',
  80: 'Chubascos leves', 81: 'Chubascos', 82: 'Chubascos intensos',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte',
};

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function wmoEmoji(code: number) {
  return WMO_EMOJI[code] ?? '🌡️';
}
function wmoDesc(code: number) {
  return WMO_DESC[code] ?? 'Variable';
}

interface WeatherCurrent { temperature_2m: number; weather_code: number; }
interface WeatherDaily {
  time: string[]; weather_code: number[];
  temperature_2m_max: number[]; temperature_2m_min: number[];
}
interface WeatherData { current: WeatherCurrent; daily: WeatherDaily; }

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showWeek, setShowWeek] = useState(false);

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-26.18&longitude=-58.18' +
      '&current=temperature_2m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=7'
    )
      .then(r => r.json())
      .then((d: WeatherData) => setWeather(d))
      .catch(() => {});
  }, []);

  if (!weather) return null;

  const temp = Math.round(weather.current.temperature_2m);
  const code = weather.current.weather_code;

  return (
    <div className="relative inline-block my-2">
      <button
        onClick={() => setShowWeek(v => !v)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 shadow-md hover:shadow-lg hover:border-sky-400 transition-all"
        title="Clic para ver pronóstico semanal — Formosa, Argentina"
      >
        <span className="text-3xl leading-none">{wmoEmoji(code)}</span>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-xl font-black text-sky-700 tabular-nums">{temp}°C</span>
          <span className="text-[11px] text-sky-500 font-medium">{wmoDesc(code)}</span>
        </div>
        <div className="flex flex-col items-end leading-tight ml-1 pl-3 border-l border-sky-200">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Formosa</span>
          <span className="text-[10px] text-gray-600">Argentina</span>
          <span className="text-sky-400 text-[9px] mt-0.5">{showWeek ? '▲ cerrar' : '▼ semana'}</span>
        </div>
      </button>

      {showWeek && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl border-2 border-sky-200 shadow-2xl p-6 w-[620px] max-w-[95vw]">
          <p className="text-sm font-bold text-sky-500 uppercase tracking-widest mb-4">
            📍 Pronóstico 7 días — Formosa, Argentina
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
            {weather.daily.time.map((date, i) => {
              const dayName = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIAS_CORTOS[new Date(date + 'T12:00:00').getDay()];
              const dCode = weather.daily.weather_code[i];
              return (
                <div
                  key={date}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl ${
                    i === 0
                      ? 'bg-sky-100 border-2 border-sky-300'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className={`text-sm font-bold ${i === 0 ? 'text-sky-600' : 'text-gray-600'}`}>{dayName}</span>
                  <span className="text-4xl leading-none my-1.5">{wmoEmoji(dCode)}</span>
                  <span className="text-xs text-gray-600 text-center leading-tight min-h-[2.2em]">{wmoDesc(dCode)}</span>
                  <span className="text-xl font-black text-orange-500 mt-1">{Math.round(weather.daily.temperature_2m_max[i])}°</span>
                  <span className="text-base font-semibold text-sky-500">{Math.round(weather.daily.temperature_2m_min[i])}°</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cotización del dólar (misma fuente/campo que "Valor U$S" en Productos) ──

interface CotizacionDia { fecha: string; compra: number; venta: number }

function fmtDiaCorto(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

// Tendencia = variación entre el primer y el último valor del rango cargado.
// Sube → rojo/ámbar (presión de costos, los productos con Valor U$S encarecen);
// baja → verde (alivio); estable → gris. No es un juicio de "bueno/malo" universal,
// es el mismo criterio de semáforo que ya usa el resto de la app (rojo = atención).
function calcularTendencia(historial: CotizacionDia[]) {
  if (historial.length < 2) return null;
  const primero = historial[0].compra;
  const ultimo = historial[historial.length - 1].compra;
  const deltaPct = primero > 0 ? ((ultimo - primero) / primero) * 100 : 0;
  const min = Math.min(...historial.map(h => h.compra));
  const max = Math.max(...historial.map(h => h.compra));
  return { deltaPct, min, max };
}

export function DolarWidget() {
  const [compra, setCompra] = useState<number | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState<CotizacionDia[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  useEffect(() => {
    api.get<{ compra: number }>('/catalogo/cotizacion-dolar')
      .then(d => setCompra(d.compra))
      .catch(() => {});
  }, []);

  function toggleHistorial() {
    const next = !showHistorial;
    setShowHistorial(next);
    if (next && !historial) {
      setCargandoHistorial(true);
      api.get<CotizacionDia[]>('/catalogo/cotizacion-dolar/historial?dias=30')
        .then(setHistorial)
        .catch(() => setHistorial([]))
        .finally(() => setCargandoHistorial(false));
    }
  }

  if (compra == null) return null;

  const tendencia = historial ? calcularTendencia(historial) : null;

  return (
    <div className="relative inline-block my-2">
      <button
        onClick={toggleHistorial}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-md hover:shadow-lg hover:border-emerald-400 transition-all"
        title="Clic para ver la evolución de los últimos 30 días"
      >
        <DollarSign size={22} className="text-emerald-600" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Valor Dólar</span>
          <span className="text-xl font-black text-emerald-700 tabular-nums">{formatCurrency(compra)}</span>
        </div>
        <span className="text-emerald-400 text-[9px] ml-1 self-end mb-0.5">{showHistorial ? '▲ cerrar' : '▼ evolución'}</span>
      </button>

      {showHistorial && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white rounded-2xl border-2 border-emerald-200 shadow-2xl p-6 w-[520px] max-w-[95vw]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest">📈 Evolución 30 días — Dólar blue</p>
          </div>

          {cargandoHistorial ? (
            <div className="h-48 bg-gray-50 animate-pulse rounded-xl mt-3" />
          ) : !historial || historial.length === 0 ? (
            <p className="text-sm text-gray-600 py-6 text-center">Todavía no hay historial registrado.</p>
          ) : (
            <>
              {/* Tendencia + min/max del período */}
              <div className="flex items-center gap-4 mt-3 mb-2">
                {tendencia ? (
                  <div className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold',
                    tendencia.deltaPct > 0.5 ? 'bg-red-50 text-red-600'
                      : tendencia.deltaPct < -0.5 ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-gray-100 text-gray-600'
                  )}>
                    {tendencia.deltaPct > 0.5 ? <TrendingUp size={13} />
                      : tendencia.deltaPct < -0.5 ? <TrendingDown size={13} />
                      : <Minus size={13} />}
                    {tendencia.deltaPct > 0 ? '+' : ''}{tendencia.deltaPct.toFixed(1)}% en el período
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">Necesitamos más días registrados para mostrar la tendencia.</p>
                )}
                {tendencia && (
                  <p className="text-[11px] text-gray-600">
                    Mín: <span className="font-semibold text-gray-700">{formatCurrency(tendencia.min)}</span>
                    {' · '}Máx: <span className="font-semibold text-gray-700">{formatCurrency(tendencia.max)}</span>
                  </p>
                )}
              </div>

              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={historial} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradDolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={fmtDiaCorto}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    interval={Math.ceil(historial.length / 6) - 1}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => formatCurrency(v)}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [formatCurrency(Number(val)), 'Compra']}
                    labelFormatter={(label: unknown) => fmtDiaCorto(String(label))}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="compra" stroke="#059669" fill="url(#gradDolar)"
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Franja combinada — usada en el header de todas las secciones (SectionHero) ──
// Dólar antes que Clima: el desplegable del pronóstico se abre hacia la derecha
// desde el Clima y taparía al Dólar si estuviera después.
export function ClimaDolarStrip() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <DolarWidget />
      <WeatherWidget />
    </div>
  );
}
