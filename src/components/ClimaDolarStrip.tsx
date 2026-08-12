import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

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

export function DolarWidget() {
  const [compra, setCompra] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ compra: number }>('/catalogo/cotizacion-dolar')
      .then(d => setCompra(d.compra))
      .catch(() => {});
  }, []);

  if (compra == null) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-md my-2"
      title="Dólar blue — usado para el indicador de precio en U$S de Productos"
    >
      <DollarSign size={22} className="text-emerald-600" />
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Valor Dólar</span>
        <span className="text-xl font-black text-emerald-700 tabular-nums">{formatCurrency(compra)}</span>
      </div>
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
