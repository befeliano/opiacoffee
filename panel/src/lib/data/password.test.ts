import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("şifre özeti", () => {
  it("doğru şifreyi kabul eder, yanlışı ve bozuk kaydı reddeder", () => {
    const h = hashPassword("Kahve2026");
    expect(verifyPassword("Kahve2026", h)).toBe(true);
    expect(verifyPassword("kahve2026", h)).toBe(false);
    expect(verifyPassword("Kahve2026", "düz-metin")).toBe(false);
  });

  it("şifre sıfırlama komutunun ürettiği kayıt girişte geçerli", () => {
    const script = path.join(process.cwd(), "scripts", "sifre-sifirla.mjs");
    const out = execFileSync(process.execPath, [script, "test@ornek.com", "Deneme12", "--sql"], { encoding: "utf8" });
    const stored = out.match(/encrypted_password = '([^']+)'/)?.[1];
    expect(stored).toBeTruthy();
    expect(verifyPassword("Deneme12", stored!)).toBe(true);
    expect(out).toContain("WHERE LOWER(email) = 'test@ornek.com'");
  });
});
