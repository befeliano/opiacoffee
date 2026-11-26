import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, themeCss } from "./site-settings";

describe("site ayarları", () => {
  it("geçersiz renk ve köşe değerlerini varsayılana çevirir (CSS içine kod sokulamaz)", () => {
    const s = normalizeSiteSettings({
      theme: { ink: "red;}</style><script>alert(1)</script>", paper: "#FFF", tint: "#abcdef", radius: 7, button: "x" },
    });
    expect(s.theme.ink).toBe(DEFAULT_SITE_SETTINGS.theme.ink);
    expect(s.theme.paper).toBe(DEFAULT_SITE_SETTINGS.theme.paper);
    expect(s.theme.tint).toBe("#abcdef");
    expect(s.theme.radius).toBe(DEFAULT_SITE_SETTINGS.theme.radius);
    expect(s.theme.button).toBe(DEFAULT_SITE_SETTINGS.theme.button);
    const css = themeCss(s.theme);
    expect(css).not.toMatch(/<|script|alert/);
  });

  it("metinleri kısaltır, boşlukları toplar", () => {
    const s = normalizeSiteSettings({ season: { title: "  a   b  ".repeat(30) }, shop: { intro: 5 } });
    expect(s.season.title.length).toBeLessThanOrEqual(40);
    expect(s.season.title.startsWith("a b")).toBe(true);
    expect(s.shop.intro).toBe(DEFAULT_SITE_SETTINGS.shop.intro);
  });

  it("yuvarlak köşe ve hap düğme CSS'e yansır", () => {
    const css = themeCss({ ...DEFAULT_SITE_SETTINGS.theme, radius: 10, button: "pill" });
    expect(css).toContain("--r:10px");
    expect(css).toContain("--rb:999px");
  });
});
