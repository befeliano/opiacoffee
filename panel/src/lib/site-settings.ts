// Tanıtım sitesinin panelden değiştirilen ayarları: renkler, köşeler, sezon başlığı, mağaza metinleri.
// Hem panel (düzenleme ekranı) hem site (tema.css, sayfalar) kullanır; veritabanında site_settings.data (JSON).

export const RADII = [0, 4, 10, 18] as const;
export type Radius = (typeof RADII)[number];
export const BUTTONS = ["square", "round", "pill"] as const;
export type ButtonShape = (typeof BUTTONS)[number];

export interface SiteTheme {
  /** Yazı, düğmeler, koyu bölümler */
  ink: string;
  /** Sayfa zemini */
  paper: string;
  /** Kartların ve görsellerin açık zemini */
  tint: string;
  /** Çizgiler ve görsel yer tutucuları */
  mid: string;
  /** Kart, görsel ve pencere köşeleri (px) */
  radius: Radius;
  button: ButtonShape;
}

export interface SiteSettings {
  theme: SiteTheme;
  season: { title: string; label: string; subtitle: string; title_en: string; label_en: string; subtitle_en: string };
  shop: { intro: string; intro_en: string };
}

export const DEFAULT_THEME: SiteTheme = { ink: "#0a0a0a", paper: "#ffffff", tint: "#f6f1e8", mid: "#e3dccf", radius: 0, button: "square" };

export const THEME_PRESETS: { name: string; theme: SiteTheme }[] = [
  { name: "Opia (siyah, beyaz, krem)", theme: DEFAULT_THEME },
  { name: "Kavrulmuş kahve", theme: { ink: "#2b1d14", paper: "#fbf8f4", tint: "#f1e9df", mid: "#dccdbd", radius: 10, button: "round" } },
  { name: "Krem ve yeşil", theme: { ink: "#1f3a2e", paper: "#fdfbf6", tint: "#eef1ea", mid: "#d3dbcf", radius: 10, button: "pill" } },
  { name: "Gece mavisi", theme: { ink: "#14213d", paper: "#ffffff", tint: "#eef1f6", mid: "#d3d9e4", radius: 4, button: "round" } },
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  theme: DEFAULT_THEME,
  season: {
    title: "OPIA Fall&Winter",
    label: "Sonbahar & Kış",
    subtitle: "Levant, Pumpkin Spice Latte, salep ve sıcak çikolata: soğuk günlerin fincanları barda.",
    title_en: "OPIA Fall&Winter",
    label_en: "Fall & Winter",
    subtitle_en: "Levant, pumpkin spice latte, salep and hot chocolate: cups for cold days, at the bar now.",
  },
  shop: {
    intro: "Barda demlediğimiz çekirdekler yakında paket olarak burada. Şimdilik barda sorabilirsin.",
    intro_en: "The beans we brew at the bar will soon be available here in bags. Until then, ask us at the bar.",
  },
};

const HEX = /^#[0-9a-f]{6}$/i;
const text = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback);

/** Gelen (ya da veritabanında duran) değeri doğrular; geçersiz alanlar varsayılana döner */
export function normalizeSiteSettings(raw: unknown): SiteSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const t = r.theme ?? {};
  const d = DEFAULT_SITE_SETTINGS;
  const color = (k: keyof SiteTheme) => (typeof t[k] === "string" && HEX.test(t[k] as string) ? (t[k] as string).toLowerCase() : (d.theme[k] as string));
  const s = r.season ?? {};
  const sh = r.shop ?? {};
  return {
    theme: {
      ink: color("ink"),
      paper: color("paper"),
      tint: color("tint"),
      mid: color("mid"),
      radius: RADII.includes(t.radius as Radius) ? (t.radius as Radius) : d.theme.radius,
      button: BUTTONS.includes(t.button as ButtonShape) ? (t.button as ButtonShape) : d.theme.button,
    },
    season: {
      title: text(s.title, 40, d.season.title),
      label: text(s.label, 40, d.season.label),
      subtitle: text(s.subtitle, 200, d.season.subtitle),
      title_en: text(s.title_en, 40, d.season.title_en),
      label_en: text(s.label_en, 40, d.season.label_en),
      subtitle_en: text(s.subtitle_en, 200, d.season.subtitle_en),
    },
    shop: {
      intro: text(sh.intro, 300, d.shop.intro),
      intro_en: text(sh.intro_en, 300, d.shop.intro_en),
    },
  };
}

/** WCAG kontrast oranı (1-21) */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Sitenin varsayılan stillerinin üstüne yazılan CSS (/tema.css) */
export function themeCss(theme: SiteTheme): string {
  const r = theme.radius;
  const btn = theme.button === "pill" ? "999px" : theme.button === "round" ? `${Math.max(r, 8)}px` : "0";
  const lines = [
    `:root{--ink:${theme.ink};--paper:${theme.paper};--tint:${theme.tint};--mid:${theme.mid};--r:${r}px;--rb:${btn}}`,
    ".hdr{background:color-mix(in srgb,var(--paper) 90%,transparent)}",
  ];
  if (theme.button !== "square") {
    lines.push(".btn,.opt,.qty,.obar__cart,.hdr__lang,.afilter,.cc button,.sheet__in button,.pm__order button,.badge,.pm__out,.mine__s,.shop__soon{border-radius:var(--rb)}");
  }
  if (r > 0) {
    lines.push(
      [
        ".hero__fig,.prod--card,.mapbox,.gal__i,.phead__fig,.tablewrap,.split__fig,.prod__thumb,.menu__note,.pm__sheet,.cc,.sheet__in,.mine,.pcard__img,.cbill,.shop__card,.toast,.sel select",
        "{border-radius:var(--r)}",
      ].join(""),
      ".pm__sheet,.prod--card,.shop__card{overflow:hidden}",
    );
  }
  return lines.join("\n");
}
