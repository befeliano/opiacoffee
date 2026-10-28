// Renk paletlerini ve karanlık temayı üretir, globals.css'in sonundaki
// işaretli bölüme yazar. Çalıştırma: node scripts/gen-theme.mjs
//
// Her kafe paleti yalnızca ham ölçeği (--p-50 … --p-900) tanımlar;
// bileşenlerin kullandığı --color-brand-* ve grafik renkleri bu ölçekten
// türetilir. Böylece yeni palet eklemek tek satırlık iştir.
import fs from "node:fs";

const FILE = "src/app/globals.css";
const MARKER = "/* ===== Paletler ve karanlık tema (scripts/gen-theme.mjs ile üretildi) ===== */";

// Paletler: 50 → 900 (açık → koyu). Anahtarlar veritabanındaki cafes.theme ile aynı.
export const PALETTES = {
  coffee: ["#fbf6f2", "#f4e7da", "#e8cdb3", "#d7ab86", "#c2885c", "#a96b3e", "#8c5531", "#6f4228", "#573422", "#462b1e"],
  forest: ["#f1f8f4", "#dcefe3", "#b9dfc8", "#8cc8a6", "#5aab80", "#3a8f63", "#2c744f", "#245d41", "#1f4a35", "#1a3d2c"],
  ocean: ["#eff6fc", "#dbeaf8", "#b9d6f1", "#8bbbe6", "#5799d7", "#367bc4", "#2862a6", "#234f86", "#20436e", "#1e395b"],
  berry: ["#fcf2f4", "#f8e0e5", "#f0c1cb", "#e396a7", "#d0687f", "#b8465f", "#98344b", "#7b2a3e", "#652536", "#552130"],
  slate: ["#f3f4f8", "#e4e7f0", "#c9cfe0", "#a3adc9", "#7985ab", "#5a6690", "#475176", "#3a4260", "#313850", "#2b3043"],
  sunset: ["#fff5ed", "#ffe7d4", "#fecaa6", "#fca56e", "#f97c3a", "#ef5f19", "#d14a0f", "#ad3b10", "#8b3214", "#722b14"],
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const SURFACE = "#1c1917";
const mix = (v, p) => `color-mix(in oklab, ${v} ${p}%, ${SURFACE})`;
const p = (n) => `var(--p-${n})`;

// Açık tema: ölçek olduğu gibi
const lightBrand = Object.fromEntries(STEPS.map((n) => [`color-brand-${n}`, p(n)]));
// Karanlık tema: ölçek ters çevrilir (koyu zeminde açık tonlar öne çıkar)
const darkBrand = {
  "color-brand-50": mix(p(500), 14),
  "color-brand-100": mix(p(500), 22),
  "color-brand-200": mix(p(500), 34),
  "color-brand-300": mix(p(500), 60),
  "color-brand-400": p(400),
  "color-brand-500": p(500),
  "color-brand-600": p(400),
  "color-brand-700": p(300),
  "color-brand-800": p(200),
  "color-brand-900": p(100),
};
// Grafikler marka ölçeğinden beslenir
const chart = {
  "chart-primary": "var(--color-brand-600)",
  "chart-tier-busy": "var(--color-brand-800)",
  "chart-tier-medium": "var(--color-brand-600)",
  "chart-tier-calm": "var(--color-brand-300)",
  "chart-heat-1": "var(--color-brand-100)",
  "chart-heat-2": "var(--color-brand-200)",
  "chart-heat-3": "var(--color-brand-300)",
  "chart-heat-4": "var(--color-brand-500)",
  "chart-heat-5": "var(--color-brand-700)",
  "chart-heat-6": "var(--color-brand-800)",
};

// Tailwind renk ailelerinin karanlık karşılıkları (durum renkleri)
const theme = fs.readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const tw = (name) => {
  const m = theme.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!m) throw new Error(name);
  return m[1].trim();
};
function chromatic(prefix) {
  const v = Object.fromEntries([100, 200, 300, 400, 500].map((n) => [n, tw(`${prefix}-${n}`)]));
  return {
    [`color-${prefix}-50`]: mix(v[500], 14),
    [`color-${prefix}-100`]: mix(v[500], 22),
    [`color-${prefix}-200`]: mix(v[500], 34),
    [`color-${prefix}-300`]: mix(v[500], 60),
    [`color-${prefix}-400`]: v[400],
    [`color-${prefix}-500`]: v[500],
    [`color-${prefix}-600`]: v[400],
    [`color-${prefix}-700`]: v[300],
    [`color-${prefix}-800`]: v[200],
    [`color-${prefix}-900`]: v[100],
  };
}
const darkCommon = {
  "color-white": SURFACE,
  "color-paper": "#110f0e",
  "color-cream": "#221c18",
  "color-stone-50": "#24201d",
  "color-stone-100": "#2c2825",
  "color-stone-200": "#3a3531",
  "color-stone-300": "#55504b",
  "color-stone-400": "#8b857f",
  "color-stone-500": "#a8a29e",
  "color-stone-600": "#c4beb9",
  "color-stone-700": "#d9d5d2",
  "color-stone-800": "#e9e6e3",
  "color-stone-900": "#f5f4f2",
  "color-stone-950": "#fbfaf9",
  ...chromatic("red"),
  ...chromatic("amber"),
  ...chromatic("emerald"),
  ...chromatic("sky"),
  "chart-heat-0": "#2a2522",
  "shadow-card": "0 1px 2px rgb(0 0 0 / 0.4)",
  "shadow-float": "0 12px 32px -8px rgb(0 0 0 / 0.7), 0 2px 6px rgb(0 0 0 / 0.4)",
};

const block = (vars, indent = "  ") =>
  Object.entries(vars)
    .map(([k, v]) => `${indent}--${k}: ${v};`)
    .join("\n");

const palettes = Object.entries(PALETTES)
  .map(([key, scale], i) => {
    const selector = i === 0 ? `:root,\n[data-cafe-theme="${key}"]` : `[data-cafe-theme="${key}"]`;
    const vars = Object.fromEntries(STEPS.map((n, j) => [`p-${n}`, scale[j]]));
    return `${selector} {\n${block(vars)}\n}`;
  })
  .join("\n");

const css = `${MARKER}

/* Kafe paletleri: Ayarlar'dan seçilir (cafes.theme). İlki varsayılan. */
${palettes}

/* Marka ve grafik renkleri paletten türetilir. Kafe sayfaları
   [data-cafe-theme] içinde çizildiği için orada yeniden hesaplanır. */
:root,
[data-cafe-theme] {
${block({ ...lightBrand, ...chart })}
}

/* Karanlık tema: data-theme="dark" (elle seçildi) ya da
   data-theme="system" + cihaz karanlık modda. */
:root[data-theme="dark"] {
  color-scheme: dark;
${block(darkCommon)}
}
:root[data-theme="dark"],
:root[data-theme="dark"] [data-cafe-theme] {
${block(darkBrand)}
}
@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] {
    color-scheme: dark;
${block(darkCommon, "    ")}
  }
  :root[data-theme="system"],
  :root[data-theme="system"] [data-cafe-theme] {
${block(darkBrand, "    ")}
  }
}
`;

let s = fs.readFileSync(FILE, "utf8");
const at = s.indexOf(MARKER);
if (at >= 0) s = s.slice(0, at);
fs.writeFileSync(FILE, s.trimEnd() + "\n\n" + css);
console.log("Paletler ve karanlık tema yazıldı.");
