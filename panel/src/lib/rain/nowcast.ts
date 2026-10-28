// Radar "nowcast": son iki RainViewer karesinden yağışın hareketini bulur,
// ileri doğru uzatarak kafe konumuna kaç dakikada ulaşacağını tahmin eder.
// Saf hesaplama; ağ ve PNG çözme işi çağırana bırakılır (test edilebilsin diye).

import { downsample, estimateMotion, nearestEchoPx, project, type Field } from "./motion";
import { dbzOf } from "./palette";

export const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";
/** Ücretsiz API'nin en yüksek yakınlaştırması (~1 km/piksel) */
export const ZOOM = 7;
const TILE = 256;
const RADIUS_TILES = 1; // 3×3 kare indirilir
const CROP = 256; // kafe etrafında ~±120 km
const DS = 2; // hareket tahmini 2 kat küçültülmüş alanda (16 kat daha ucuz)

export interface RainOptions {
  /** Yağış sayılan en düşük yansıtıcılık (20 dBZ ≈ 0,6 mm/saat hafif yağmur) */
  rainDbz: number;
  /** Kafe çevresinde (checkR) en az bu kadar yağışlı piksel */
  minPixels: number;
  checkR: number;
  /** Bu kadar dakika ya da daha yakınsa uyar */
  warnMin: number;
  /** Radar karesi bundan eskiyse güvenilmez */
  staleMin: number;
}

export const DEFAULT_OPTIONS: RainOptions = { rainDbz: 20, minPixels: 3, checkR: 2, warnMin: 15, staleMin: 30 };

export interface RainStatus {
  checkedAt: number; // ms
  frameTime: number; // radar karesi, unix sn
  frameAgeMin: number;
  stale: boolean;
  /** Kontrol anından itibaren dakika; 0 = şu an yağıyor / başlamak üzere */
  etaMin: number | null;
  nearestKm: number | null;
  speedKmh: number | null;
  /** Yağışın geldiği yön (0 = kuzey, 90 = doğu) */
  fromDeg: number | null;
  alert: boolean;
}

export interface RadarFrames {
  host: string;
  previous: { time: number; path: string };
  latest: { time: number; path: string };
}

export interface RgbaImage {
  width: number;
  height: number;
  /** RGBA, satır satır */
  data: ArrayLike<number>;
}
export type TileLoader = (url: string) => Promise<RgbaImage>;

/** RainViewer meta verisinden son iki radar karesi */
export function latestFrames(meta: { host: string; radar?: { past?: { time: number; path: string }[] } }): RadarFrames {
  const past = meta.radar?.past ?? [];
  if (past.length < 2) throw new Error("yeterli radar karesi yok");
  return { host: meta.host, previous: past[past.length - 2], latest: past[past.length - 1] };
}

/** Universal Blue renkli kareyi dBZ alanına çevirir */
export function tileToDbz(img: RgbaImage): Float32Array {
  if (img.width !== TILE || img.height !== TILE) throw new Error("beklenmeyen kare boyutu");
  const out = new Float32Array(TILE * TILE);
  const d = img.data;
  for (let i = 0; i < out.length; i++) {
    const a = d[i * 4 + 3];
    out[i] = a === 0 ? 0 : Math.max(0, dbzOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], a));
  }
  return out;
}

function globalPx(lat: number, lon: number) {
  const n = 2 ** ZOOM;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  return { x: x * TILE, y: y * TILE };
}

async function buildField(host: string, path: string, tx: number, ty: number, x0: number, y0: number, load: TileLoader): Promise<Field> {
  const n = 2 * RADIUS_TILES + 1;
  const full = TILE * n;
  const mosaic = new Float32Array(full * full);
  await Promise.all(
    Array.from({ length: n * n }, async (_, k) => {
      const i = k % n;
      const j = Math.floor(k / n);
      const url = `${host}${path}/${TILE}/${ZOOM}/${tx - RADIUS_TILES + i}/${ty - RADIUS_TILES + j}/2/0_0.png`;
      const tile = tileToDbz(await load(url));
      for (let row = 0; row < TILE; row++) mosaic.set(tile.subarray(row * TILE, (row + 1) * TILE), (j * TILE + row) * full + i * TILE);
    }),
  );
  const out = new Float32Array(CROP * CROP);
  for (let y = 0; y < CROP; y++) {
    const start = (y0 + y) * full + x0;
    out.set(mosaic.subarray(start, start + CROP), y * CROP);
  }
  return { data: out, w: CROP, h: CROP };
}

/** Bir konum için yağış durumunu hesaplar */
export async function computeRainStatus(
  lat: number,
  lon: number,
  frames: RadarFrames,
  load: TileLoader,
  opts: RainOptions = DEFAULT_OPTIONS,
  nowMs = Date.now(),
): Promise<RainStatus> {
  const { previous, latest } = frames;
  const dtMin = (latest.time - previous.time) / 60;
  const ageMin = (nowMs / 1000 - latest.time) / 60;
  const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** ZOOM; // metre / piksel

  // Kafenin konumu ve kırpma penceresi (iki kare için aynı)
  const g = globalPx(lat, lon);
  const tx = Math.floor(g.x / TILE);
  const ty = Math.floor(g.y / TILE);
  const cxMosaic = g.x - (tx - RADIUS_TILES) * TILE;
  const cyMosaic = g.y - (ty - RADIUS_TILES) * TILE;
  const x0 = Math.round(cxMosaic - CROP / 2);
  const y0 = Math.round(cyMosaic - CROP / 2);
  const cx = cxMosaic - x0;
  const cy = cyMosaic - y0;

  const [a, b] = await Promise.all([
    buildField(frames.host, previous.path, tx, ty, x0, y0, load),
    buildField(frames.host, latest.path, tx, ty, x0, y0, load),
  ]);

  // Hareket küçük alanda bulunur, tam çözünürlüğe ölçeklenir (px/dk)
  const motion = dtMin > 0 ? estimateMotion(downsample(a, DS), downsample(b, DS), 10) : null;
  const v = motion ? { x: (motion.dx * DS) / dtMin, y: (motion.dy * DS) / dtMin } : { x: 0, y: 0 };

  // Kare yaşını telafi et: tahmin kare anından başlar, gerçek ETA'dan yaş düşülür
  const horizon = 30 + Math.ceil(Math.max(ageMin, 0));
  const proj = project(b, cx, cy, v.x, v.y, { rainDbz: opts.rainDbz, minPixels: opts.minPixels, checkR: opts.checkR, horizonMin: horizon, stepMin: 1 });
  const etaMin = proj.etaMin === null ? null : Math.max(0, Math.round(proj.etaMin - ageMin));

  const nearest = nearestEchoPx(b, cx, cy, opts.rainDbz);
  const stale = ageMin > opts.staleMin;
  const speedKmh = motion ? ((Math.hypot(v.x, v.y) * mpp) / 1000) * 60 : null;
  const toDeg = motion ? (Math.atan2(v.x, -v.y) * 180) / Math.PI : null;

  return {
    checkedAt: nowMs,
    frameTime: latest.time,
    frameAgeMin: Math.round(ageMin * 10) / 10,
    stale,
    etaMin,
    nearestKm: nearest === null ? null : Math.round((nearest * mpp) / 100) / 10,
    speedKmh: speedKmh === null ? null : Math.round(speedKmh),
    fromDeg: toDeg === null ? null : Math.round((toDeg + 540) % 360),
    alert: !stale && etaMin !== null && etaMin <= opts.warnMin,
  };
}
