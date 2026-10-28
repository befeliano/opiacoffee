import { describe, expect, it } from "vitest";
import { downsample, estimateMotion, project, type Field } from "./motion";
import { computeRainStatus, DEFAULT_OPTIONS, type RgbaImage } from "./nowcast";
import { dbzOf } from "./palette";

/** w×h alanda (cx, cy) merkezli, r yarıçaplı, dbz şiddetinde yağış hücresi */
function blob(w: number, h: number, cx: number, cy: number, r: number, dbz = 35): Field {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - cx, y - cy) <= r) data[y * w + x] = dbz;
  return { data, w, h };
}

describe("renk tablosu (Universal Blue)", () => {
  it("radarda görülen renkleri doğru dBZ'ye çevirir", () => {
    expect(dbzOf(0, 145, 202, 255)).toBe(22); // #0091ca
    expect(dbzOf(222, 208, 151, 190)).toBe(14); // #ded097be (hafif)
    expect(dbzOf(0, 0, 0, 0)).toBe(0); // saydam = yağış yok
    expect(dbzOf(1, 146, 203, 255)).toBe(22); // tabloda olmayan renk en yakına
  });
});

describe("hareket tahmini", () => {
  it("doğuya kayan hücrenin hızını bulur ve kafeye varış süresini hesaplar", () => {
    // 10 dk'da 6 piksel doğuya
    const a = blob(128, 128, 40, 64, 6);
    const b = blob(128, 128, 46, 64, 6);
    const m = estimateMotion(a, b, 10)!;
    expect(m.dx).toBeCloseTo(6, 0);
    expect(m.dy).toBeCloseTo(0, 0);
    // Kafe (64, 64): hücre kenarı 52'de, 12 px uzakta, 0,6 px/dk → ~20 dk
    const p = project(b, 64, 64, m.dx / 10, m.dy / 10, { rainDbz: 20, minPixels: 3, checkR: 2, horizonMin: 40, stepMin: 1 });
    expect(p.etaMin).toBeGreaterThanOrEqual(17);
    expect(p.etaMin).toBeLessThanOrEqual(22);
  });

  it("küçültme yağış hücresini kaybetmez (en yüksek değer)", () => {
    const f = blob(8, 8, 3, 3, 0, 40);
    const d = downsample(f, 2);
    expect(d.w).toBe(4);
    expect(Math.max(...d.data)).toBe(40);
  });
});

describe("konum için yağış durumu", () => {
  it("batıdan yaklaşan yağışta uyarır; yön ve hız tutarlı", async () => {
    // Her kareyi sentetik üret: kafenin batısında, 10 dk'da doğuya ilerleyen şerit
    const color = [0, 145, 202, 255]; // 22 dBZ
    const frames = { host: "h", previous: { time: 0, path: "/p0" }, latest: { time: 600, path: "/p1" } };
    // Kafe = global piksel; kareler ZOOM 7'de. Sütun indeksine göre şerit çiz.
    const lat = 39.775864, lon = 30.51576;
    const n = 2 ** 7;
    const gx = ((lon + 180) / 360) * n * 256;
    const load = async (url: string): Promise<RgbaImage> => {
      const m = url.match(/\/p(\d)\/256\/7\/(\d+)\/(\d+)\//)!;
      const shift = Number(m[1]) * 8; // ikinci karede 8 px doğuda
      const tx = Number(m[2]);
      const data = new Uint8Array(256 * 256 * 4);
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 256; x++) {
          const g = tx * 256 + x; // global x
          const rel = g - gx; // kafeye göre
          if (rel >= -60 + shift && rel <= -30 + shift) data.set(color, (y * 256 + x) * 4);
        }
      return { width: 256, height: 256, data };
    };
    const s = await computeRainStatus(lat, lon, frames, load, { ...DEFAULT_OPTIONS, warnMin: 60, staleMin: 1e9 }, 600_000);
    expect(s.alert).toBe(true);
    expect(s.etaMin).toBeGreaterThan(10);
    expect(s.etaMin).toBeLessThan(40);
    expect(s.fromDeg).toBeGreaterThan(225); // batıdan
    expect(s.fromDeg).toBeLessThan(315);
  });
});
