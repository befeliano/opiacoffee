import type { CafeTheme } from "@/lib/api/types";

/** Kafe renk paletleri (renk değerleri: scripts/gen-theme.mjs → globals.css) */
export const THEMES: { key: CafeTheme; label: string; swatch: string }[] = [
  { key: "coffee", label: "Kahve", swatch: "#8c5531" },
  { key: "forest", label: "Orman", swatch: "#2c744f" },
  { key: "ocean", label: "Okyanus", swatch: "#2862a6" },
  { key: "berry", label: "Bordo", swatch: "#98344b" },
  { key: "slate", label: "Gece", swatch: "#475176" },
  { key: "sunset", label: "Turuncu", swatch: "#d14a0f" },
];

/** Tarayıcı çubuğu rengi (palet 600) */
export const THEME_COLOR = Object.fromEntries(THEMES.map((t) => [t.key, t.swatch])) as Record<CafeTheme, string>;
