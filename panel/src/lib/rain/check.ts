import "server-only";
// Radar kontrolü (Supabase'deki rain-check Edge Function'ın Node karşılığı; MySQL sürümünde kullanılır).
// Zamanlayıcı yok: tabletler durumu okurken son ölçüm 5 dakikadan eskiyse panel sunucusu yeniden ölçer.
// Aynı anda tek ölçüm yapılır; aynı radar karesi bir çalışmada bir kez indirilir.

import { decode } from "fast-png";
import { computeRainStatus, DEFAULT_OPTIONS, latestFrames, RAINVIEWER_API, type RgbaImage } from "./nowcast";

export const RAIN_INTERVAL_MS = 5 * 60_000;

type Target = { cafe_id: string; lat: number; lon: number; warn_min: number };

async function loadTile(url: string): Promise<RgbaImage> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`kare ${res.status}`);
  const png = decode(new Uint8Array(await res.arrayBuffer()));
  const { width, height, channels } = png;
  if (channels === 4 && png.depth === 8) return { width, height, data: png.data };
  // Beklenmeyen biçim: RGBA'ya çevir
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (png.palette) {
      const p = png.palette[png.data[i]] ?? [0, 0, 0, 0];
      rgba.set([p[0], p[1], p[2], p[3] ?? 255], i * 4);
    } else if (channels === 3) {
      rgba.set([png.data[i * 3], png.data[i * 3 + 1], png.data[i * 3 + 2], 255], i * 4);
    } else {
      throw new Error(`desteklenmeyen PNG (${channels} kanal, ${png.depth} bit)`);
    }
  }
  return { width, height, data: rgba };
}

let running: Promise<void> | null = null;
let lastRun = 0;

/** Bütün konumlu kafeler için ölçer ve yazar (en fazla 5 dakikada bir) */
export function refreshRainIfDue(): Promise<void> {
  if (running) return running;
  if (Date.now() - lastRun < RAIN_INTERVAL_MS) return Promise.resolve();
  lastRun = Date.now();
  running = (async () => {
    const { getMysql } = await import("@/lib/data/mysql/server");
    const { pool, engine } = await getMysql();
    const service = { role: "service_role" as const };
    const targets = await engine.mysqlRpc<Target[]>(pool, null, "rain_targets", {}, service);
    if (!targets.length) return;

    const metaRes = await fetch(RAINVIEWER_API, { signal: AbortSignal.timeout(15_000) });
    if (!metaRes.ok) throw new Error(`weather-maps ${metaRes.status}`);
    const frames = latestFrames(await metaRes.json());
    const cache = new Map<string, Promise<RgbaImage>>();
    const load = (u: string) => {
      if (!cache.has(u)) cache.set(u, loadTile(u));
      return cache.get(u)!;
    };

    // Aynı konum + eşik → tek hesap
    const groups = new Map<string, Target[]>();
    for (const t of targets) {
      const k = `${t.lat.toFixed(4)},${t.lon.toFixed(4)},${t.warn_min}`;
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    for (const list of groups.values()) {
      const { lat, lon, warn_min } = list[0];
      const status = await computeRainStatus(lat, lon, frames, load, { ...DEFAULT_OPTIONS, warnMin: warn_min });
      for (const t of list) await engine.mysqlRpc(pool, null, "rain_report", { p_cafe: t.cafe_id, p_status: status }, service);
    }
  })()
    .catch((error) => console.error("[yağmur]", error))
    .finally(() => {
      running = null;
    });
  return running;
}
