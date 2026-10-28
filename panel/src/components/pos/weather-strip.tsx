"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Radar, Snowflake, Sun, Umbrella, type LucideIcon } from "lucide-react";
import { weatherIcon, weatherLabel, type WeatherIcon } from "@/lib/domain/weather";
import { useWeather } from "@/lib/weather/use-weather";
import type { LiveConfig } from "./live";
import { useRainStatus } from "./rain-alert";

const ICONS: Record<WeatherIcon, LucideIcon> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
  snow: Snowflake,
};

/** Bu ihtimalden itibaren "yağmur bekleniyor" denir */
const LIKELY = 50;

/**
 * Masalar ekranının üstünde her zaman görünen hava durumu: anlık durum,
 * bugünün kalanındaki en yüksek yağış ihtimali, yağmurun beklendiği ilk saat
 * ve radar (en yakın yağış). Veri tarayıcıdan Open-Meteo'dan, radar bilgisi rain_status'tan gelir.
 */
export function WeatherStrip({ cafeId, live }: { cafeId: string; live: LiveConfig }) {
  const weather = useWeather();
  const [radar] = useRainStatus(cafeId, live, "strip");
  if (!weather?.current) return null;

  const { current } = weather;
  const Icon = ICONS[weatherIcon(current.code)];
  const nowHour = current.time.slice(0, 13); // "2026-10-29T14"
  const today = current.time.slice(0, 10);
  const rest = weather.hourly.filter((h) => h.time.slice(0, 13) >= nowHour && h.time.startsWith(today));
  const maxProb = rest.reduce((m, h) => Math.max(m, h.precipProb ?? 0), 0);
  const firstWet = rest.find((h) => (h.precipProb ?? 0) >= LIKELY);
  const day = weather.daily.find((d) => d.date === today);

  // Radar ölçümü taze mi (hava verisinin çekildiği ana göre; kontrol durduysa gösterme)
  const radarFresh = radar && Math.abs(weather.fetchedAt - Date.parse(radar.checked_at)) < 30 * 60_000;
  const radarText = !radarFresh
    ? null
    : radar.eta_min !== null
      ? radar.eta_min === 0
        ? "Radar: şu an yağış var"
        : `Radar: ~${radar.eta_min} dk'da yağmur`
      : radar.nearest_km !== null
        ? `Radar: en yakın yağış ${Math.round(Number(radar.nearest_km))} km`
        : "Radar: çevrede yağış yok";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 self-start rounded-2xl border border-stone-200 bg-white px-3 py-2 text-[13px] text-stone-600 shadow-card">
      <span className="flex items-center gap-1.5 font-semibold text-stone-900">
        <Icon className="size-5 text-brand-600" />
        <span className="text-[16px] font-extrabold tabular-nums">{Math.round(current.temp)}°</span>
        {weatherLabel(current.code)}
      </span>
      {day && day.tmax !== null && day.tmin !== null && (
        <span className="tabular-nums text-stone-500">
          {Math.round(day.tmin)}° / {Math.round(day.tmax)}°
        </span>
      )}
      <span className={maxProb >= LIKELY ? "flex items-center gap-1 font-semibold text-sky-700" : "flex items-center gap-1"}>
        <Umbrella className="size-4" />
        {firstWet ? `${firstWet.time.slice(11, 16)}'den itibaren yağış %${firstWet.precipProb}` : `Bugün yağış ihtimali %${maxProb}`}
      </span>
      {radarText && (
        <span className="flex items-center gap-1 text-stone-500">
          <Radar className="size-4" /> {radarText}
        </span>
      )}
    </div>
  );
}
