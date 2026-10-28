// Saf hesaplama: dış bağımlılık yok, test etmesi kolay.

export interface Field {
  data: Float32Array; // dBZ, satır satır (y aşağı doğru artar)
  w: number;
  h: number;
}

export interface Motion {
  dx: number; // px / kare aralığı
  dy: number;
}

/**
 * b(x, y) ≈ a(x - dx, y - dy) olacak şekilde yağış alanının kaymasını bulur.
 * Sabit bir pencerede tüm kaymaları dener (blok eşleştirme) + alt piksel iyileştirme.
 * Güvenilir sonuç yoksa null döner.
 */
export function estimateMotion(
  a: Field,
  b: Field,
  maxShift = 20,
  minDbz = 10,
): Motion | null {
  const { w, h } = a;
  const m = maxShift;

  const clean = (f: Field) => {
    const out = new Float32Array(f.data.length);
    let n = 0;
    for (let i = 0; i < out.length; i++) {
      if (f.data[i] >= minDbz) {
        out[i] = f.data[i];
        n++;
      }
    }
    return { out, n };
  };
  const A = clean(a);
  const B = clean(b);
  if (A.n < 20 || B.n < 20) return null;

  // Değerlendirme penceresi sabit: [m, w-m) x [m, h-m)
  let inWindow = 0;
  for (let y = m; y < h - m; y++)
    for (let x = m; x < w - m; x++) if (B.out[y * w + x] > 0) inWindow++;
  if (inWindow < 10) return null;

  const size = 2 * m + 1;
  const cost = new Float64Array(size * size);
  let best = Infinity;
  let bx = 0;
  let by = 0;

  for (let sy = -m; sy <= m; sy++) {
    for (let sx = -m; sx <= m; sx++) {
      let sum = 0;
      for (let y = m; y < h - m; y++) {
        const rb = y * w;
        const ra = (y - sy) * w - sx;
        for (let x = m; x < w - m; x++) {
          const d = B.out[rb + x] - A.out[ra + x];
          sum += d * d;
        }
      }
      sum += 1e-6 * (sx * sx + sy * sy); // eşitlikte küçük kaymayı tercih et
      cost[(sy + m) * size + (sx + m)] = sum;
      if (sum < best) {
        best = sum;
        bx = sx;
        by = sy;
      }
    }
  }

  // Arama sınırına dayandıysa eşleşme güvenilir değil
  if (Math.abs(bx) === m || Math.abs(by) === m) return null;

  const at = (i: number, j: number) => cost[(j + m) * size + (i + m)];
  const refine = (lo: number, c: number, hi: number) => {
    const d = lo - 2 * c + hi;
    return d > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (lo - hi)) / d)) : 0;
  };
  const rx = refine(at(bx - 1, by), at(bx, by), at(bx + 1, by));
  const ry = refine(at(bx, by - 1), at(bx, by), at(bx, by + 1));
  return { dx: bx + rx, dy: by + ry };
}

export interface ProjectOpts {
  rainDbz: number;
  minPixels: number;
  checkR: number;
  horizonMin: number;
  stepMin: number;
}

/** Hareketi geriye alarak t dk sonra kafe noktasında yağış var mı bakar. v: px/dk */
export function project(
  field: Field,
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  o: ProjectOpts,
) {
  const { data, w, h } = field;
  const rows: { t: number; maxDbz: number; wetPixels: number }[] = [];
  let etaMin: number | null = null;

  for (let t = 0; t <= o.horizonMin; t += o.stepMin) {
    const sx = Math.round(cx - vx * t);
    const sy = Math.round(cy - vy * t);
    let wet = 0;
    let max = 0;
    for (let y = Math.max(sy - o.checkR, 0); y <= Math.min(sy + o.checkR, h - 1); y++) {
      for (let x = Math.max(sx - o.checkR, 0); x <= Math.min(sx + o.checkR, w - 1); x++) {
        const v = data[y * w + x];
        if (v > max) max = v;
        if (v >= o.rainDbz) wet++;
      }
    }
    rows.push({ t, maxDbz: max, wetPixels: wet });
    if (etaMin === null && wet >= o.minPixels) etaMin = t;
  }
  return { etaMin, rows };
}

/** Kafeye en yakın yağış pikselinin mesafesi (px). Yoksa null. */
export function nearestEchoPx(field: Field, cx: number, cy: number, dbz: number) {
  let best = Infinity;
  for (let y = 0; y < field.h; y++) {
    for (let x = 0; x < field.w; x++) {
      if (field.data[y * field.w + x] >= dbz) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < best) best = d;
      }
    }
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * Alanı `factor` kat küçültür (her bloğun en yüksek değeri; küçük yağış
 * hücreleri kaybolmasın). Hareket tahmini küçük alanda çok daha ucuzdur.
 */
export function downsample(field: Field, factor: number): Field {
  const w = Math.floor(field.w / factor);
  const h = Math.floor(field.h / factor);
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let max = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * field.w + x * factor;
        for (let dx = 0; dx < factor; dx++) {
          const v = field.data[row + dx];
          if (v > max) max = v;
        }
      }
      data[y * w + x] = max;
    }
  }
  return { data, w, h };
}
