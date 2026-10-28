"use client";

import { useEffect, useState } from "react";
import { CAFE_LOCATION } from "@/config";
import { parseOpenMeteo, type WeatherData } from "@/lib/domain/weather";

// Open-Meteo (anahtarsız, ücretsiz) doğrudan tarayıcıdan çağrılır; Vercel'e
// istek gitmez. Tek istekte: anlık durum, saatlik yağış ihtimali, son 92 gün
// ve önümüzdeki 7 günün günlük havası. Sonuç cihazda 15 dk saklanır.

const TTL_MS = 15 * 60_000;
const STORAGE_KEY = "ad_weather_v1";

const URL_ =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${CAFE_LOCATION.lat}&longitude=${CAFE_LOCATION.lon}` +
  `&timezone=${encodeURIComponent(CAFE_LOCATION.timezone)}` +
  "&current=temperature_2m,weather_code,wind_speed_10m,precipitation" +
  "&hourly=precipitation_probability,weather_code,temperature_2m" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,cloud_cover_mean" +
  "&past_days=92&forecast_days=8";

let memory: WeatherData | null = null;
let inflight: Promise<WeatherData | null> | null = null;

function readStored(): WeatherData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WeatherData) : null;
  } catch {
    return null;
  }
}

function fresh(d: WeatherData | null) {
  return !!d && Date.now() - d.fetchedAt < TTL_MS;
}

async function load(): Promise<WeatherData | null> {
  if (fresh(memory)) return memory;
  const stored = readStored();
  if (fresh(stored)) return (memory = stored);
  inflight ??= fetch(URL_)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((json) => {
      memory = parseOpenMeteo(json);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
      } catch {
        // depolama kapalı olabilir
      }
      return memory;
    })
    .catch(() => memory ?? stored) // ağ hatasında eldeki (eski) veriyle devam
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Kafe konumunun hava durumu; 15 dk'da bir tazelenir. Yüklenene kadar null. */
export function useWeather(): WeatherData | null {
  const [data, setData] = useState<WeatherData | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => void load().then((d) => alive && d && setData(d));
    run();
    const t = setInterval(run, TTL_MS);
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return data;
}
