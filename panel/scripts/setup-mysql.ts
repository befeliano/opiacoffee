/**
 * MySQL (Hostinger) kurulumu: tabloları, Opia kafesini (menü, masalar, logo) ve hesapları oluşturur.
 *
 *   npm run setup:mysql            → gerçek kurulum (satış verisi yok)
 *   npm run setup:mysql -- --demo  → üstüne 60 günlük örnek satış (Ayarlar › Test verisi'nden silinir)
 *
 * Gerekli ortam değişkenleri (.env.local ya da Hostinger panelinde):
 *   DATABASE_URL     mysql://kullanici:sifre@localhost:3306/veritabani
 *   OWNER_EMAIL      sahip hesabının e-postası
 *   OWNER_PASSWORD   sahip hesabının ilk şifresi (en az 8 karakter; sonra Ayarlar'dan değiştir)
 *   OWNER_NAME       (isteğe bağlı) ekranda görünen ad
 *   BAR_EMAIL / BAR_PASSWORD  (isteğe bağlı) bar için kısıtlı personel hesabı
 *
 * Tekrar çalıştırmak güvenlidir: var olan kafe ve hesaplar atlanır.
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePool, getPool, migrateMysql } from "../src/lib/data/mysql/db";
import { createMysqlUser, findMysqlUser, mysqlRpc } from "../src/lib/data/mysql/engine";
import { buildCafePayload, DEFAULT_CARD_COMMISSION, DEFAULT_TIMEZONE } from "../src/lib/seed/menus";
import { OPIA_CAFE } from "../src/lib/seed/opia";
import { generateDemoOrders } from "../src/lib/seed/demo";
import { demoExpenses } from "../src/lib/seed/expenses";

const service = { role: "service_role" as const };

async function loadEnv() {
  try {
    const text = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local yoksa ortam değişkenlerine bakılır
  }
}

function need(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} tanımlı değil (bkz. dosyanın başındaki açıklama).`);
  return value;
}

async function ensureUser(email: string, password: string) {
  const pool = getPool();
  const existing = await findMysqlUser(pool, email);
  if (existing) {
    console.log(`  hesap zaten var: ${email} (şifresine dokunulmadı)`);
    return existing.id;
  }
  if (password.length < 8) throw new Error(`${email} için şifre en az 8 karakter olmalı.`);
  console.log(`  hesap açıldı: ${email}`);
  return createMysqlUser(pool, email, password);
}

async function main() {
  await loadEnv();
  const demo = process.argv.includes("--demo");
  need("DATABASE_URL");
  const pool = getPool();

  console.log("Tablolar…");
  await migrateMysql(pool);

  const ownerId = await ensureUser(need("OWNER_EMAIL").toLowerCase(), need("OWNER_PASSWORD"));
  const ownerName = process.env.OWNER_NAME?.trim() || "Sahip";

  let cafeId = await mysqlRpc<string | null>(pool, null, "admin_cafe_by_slug", { p_slug: OPIA_CAFE.slug }, service);
  let ids: ReturnType<typeof buildCafePayload>["ids"] | null = null;
  if (cafeId) {
    console.log(`Kafe zaten kurulu (${OPIA_CAFE.slug}); menüye dokunulmadı.`);
  } else {
    console.log("Opia kafesi, menü ve masalar…");
    const built = buildCafePayload(OPIA_CAFE, { demo, uuid: randomUUID });
    await mysqlRpc(pool, null, "admin_create_cafe", { p_owner: ownerId, p_owner_name: ownerName, p_payload: built.payload }, service);
    cafeId = built.ids.cafeId;
    ids = built.ids;

    const logo = await readFile(path.join(process.cwd(), "public", "opia", "logo.png"));
    // Konum: yağmur uyarısı ve hava durumu için (src/site/config.ts ile aynı)
    await pool.query("UPDATE cafes SET logo = ?, vat_rate = 0.10, lat = 39.785454, lon = 30.502377 WHERE id = ?", [
      `data:image/png;base64,${logo.toString("base64")}`,
      cafeId,
    ]);
  }

  await mysqlRpc(pool, null, "admin_add_member", { p_cafe: cafeId, p_user: ownerId, p_role: "owner", p_display_name: ownerName }, service);

  if (process.env.BAR_EMAIL && process.env.BAR_PASSWORD) {
    const barId = await ensureUser(process.env.BAR_EMAIL.toLowerCase(), process.env.BAR_PASSWORD);
    await mysqlRpc(pool, null, "admin_add_member", { p_cafe: cafeId, p_user: barId, p_role: "staff", p_display_name: "Bar" }, service);
  }

  if (demo && ids) {
    console.log("Örnek satış verisi…");
    const data = generateDemoOrders(OPIA_CAFE, ids, {
      days: 60,
      now: new Date(),
      tz: OPIA_CAFE.timezone ?? DEFAULT_TIMEZONE,
      seed: 20261028,
      commissionRate: OPIA_CAFE.cardCommissionRate ?? DEFAULT_CARD_COMMISSION,
      uuid: randomUUID,
    });
    for (let i = 0; i < data.orders.length; i += 800) {
      const orders = data.orders.slice(i, i + 800);
      const set = new Set(orders.map((o) => o.id));
      await mysqlRpc(pool, null, "admin_import_orders", {
        p_cafe: cafeId,
        p_payload: { orders, items: data.items.filter((x) => set.has(x.order_id)), payments: data.payments.filter((x) => set.has(x.order_id)) },
      }, service);
    }
    await mysqlRpc(pool, null, "admin_import_expenses", { p_cafe: cafeId, p_payload: { expenses: demoExpenses(new Date()) } }, service);
  }

  console.log("Tamam. Panel adresine gidip sahip hesabıyla giriş yapabilirsin.");
  await closePool();
}

main().catch(async (error) => {
  console.error("Kurulum durdu:", error instanceof Error ? error.message : error);
  await closePool();
  process.exit(1);
});
