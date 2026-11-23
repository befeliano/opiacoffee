/**
 * Kurulmuş bir veritabanındaki Opia menüsünü src/lib/seed/opia.ts ile eşitler.
 *
 *   npm run menu:mysql             → ne değişeceğini yazar, hiçbir şeye dokunmaz
 *   npm run menu:mysql -- --apply  → değişiklikleri uygular
 *
 * - Ürünler adla eşleşir: fiyat, açıklama, etiket, kategori ve sıra güncellenir; olmayanlar eklenir.
 * - Yeni menüde olmayan ürünler silinmez: satıştan kalkar ve kategorisiz kalır (geçmiş satışlar ve
 *   reçeteleri korunur, sitede görünmez). Panelde Menü ekranından geri alınabilir.
 * - Hammaddeler, reçeteler ve maliyetlere dokunulmaz.
 * Önce yedek almak iyi olur (Hostinger › Veritabanları › phpMyAdmin › Dışa aktar).
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { closePool, getPool, migrateMysql } from "../src/lib/data/mysql/db";
import { OPIA_CAFE } from "../src/lib/seed/opia";

// Adı değişen ürünler: eski ad → yeni ad (geçmiş satışlar aynı üründe kalsın)
const RENAMED: Record<string, string> = {
  Cappuccino: "Cappucino",
  Brownie: "Beyaz Çikolatalı Brownie",
  "Duble Türk Kahvesi": "Double Türk Kahvesi",
  "Klasik Sıcak Çikolata": "Sıcak Çikolata",
  Mocha: "Dark Chocolate Mocha",
  "Büyükanne Turtası": "Torte della Nonna",
};

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

const key = (s: string) => s.trim().toLocaleLowerCase("tr-TR");

async function rows<T>(c: PoolConnection, sql: string, params: unknown[]) {
  return (await c.query<RowDataPacket[]>(sql, params))[0] as T[];
}

async function sync(c: PoolConnection, cafeId: string, log: (s: string) => void) {
  // Seçenek grupları ve seçenekler
  const groupId = new Map<string, string>();
  const dbGroups = await rows<{ id: string; name: string }>(c, "SELECT id, name FROM option_groups WHERE cafe_id = ?", [cafeId]);
  for (const [gi, g] of OPIA_CAFE.groups.entries()) {
    let id = dbGroups.find((x) => key(x.name) === key(g.name))?.id;
    if (id) {
      await c.query("UPDATE option_groups SET selection = ?, sort_order = ? WHERE id = ?", [g.selection, gi, id]);
    } else {
      id = randomUUID();
      log(`+ seçenek grubu: ${g.name}`);
      await c.query("INSERT INTO option_groups (id, cafe_id, name, selection, is_required, sort_order) VALUES (?,?,?,?,?,?)", [id, cafeId, g.name, g.selection, g.isRequired ? 1 : 0, gi]);
    }
    groupId.set(g.key, id);
    const dbOpts = await rows<{ id: string; name: string; price_delta: string; is_active: number }>(c, "SELECT id, name, price_delta, is_active FROM options WHERE group_id = ?", [id]);
    for (const [oi, o] of g.options.entries()) {
      const ex = dbOpts.find((x) => key(x.name) === key(o.name));
      const delta = o.priceDelta ?? 0;
      if (ex) {
        if (Number(ex.price_delta) !== delta || !ex.is_active) log(`~ ${g.name} › ${o.name}: +${Number(ex.price_delta)} → +${delta}`);
        await c.query("UPDATE options SET price_delta = ?, is_default = ?, is_active = 1, sort_order = ? WHERE id = ?", [delta, o.isDefault ? 1 : 0, oi, ex.id]);
      } else {
        log(`+ ${g.name} › ${o.name} (+${delta})`);
        await c.query("INSERT INTO options (id, cafe_id, group_id, name, price_delta, is_default, sort_order) VALUES (?,?,?,?,?,?,?)", [randomUUID(), cafeId, id, o.name, delta, o.isDefault ? 1 : 0, oi]);
      }
    }
    for (const ex of dbOpts) {
      if (ex.is_active && !g.options.some((o) => key(o.name) === key(ex.name))) {
        log(`- ${g.name} › ${ex.name} (kapatıldı)`);
        await c.query("UPDATE options SET is_active = 0, is_default = 0 WHERE id = ?", [ex.id]);
      }
    }
  }

  // Kategoriler
  const dbCats = await rows<{ id: string; name: string }>(c, "SELECT id, name FROM categories WHERE cafe_id = ?", [cafeId]);
  const catId = new Map<string, string>();
  for (const [ci, cat] of OPIA_CAFE.categories.entries()) {
    let id = dbCats.find((x) => key(x.name) === key(cat.name))?.id;
    if (id) {
      await c.query("UPDATE categories SET subtitle = ?, sort_order = ? WHERE id = ?", [cat.subtitle ?? "", ci, id]);
    } else {
      id = randomUUID();
      log(`+ kategori: ${cat.name}`);
      await c.query("INSERT INTO categories (id, cafe_id, name, subtitle, sort_order) VALUES (?,?,?,?,?)", [id, cafeId, cat.name, cat.subtitle ?? "", ci]);
    }
    catId.set(cat.name, id);
  }

  // Ürünler
  const dbProds = await rows<{ id: string; name: string; price: string; is_active: number; category_id: string | null; is_open_price: number }>(
    c,
    "SELECT id, name, price, is_active, category_id, is_open_price FROM products WHERE cafe_id = ?",
    [cafeId],
  );
  const byName = new Map(dbProds.filter((p) => !p.is_open_price).map((p) => [key(RENAMED[p.name] ?? p.name), p]));
  const kept = new Set<string>();
  const favorites = OPIA_CAFE.favorites ?? [];
  for (const cat of OPIA_CAFE.categories) {
    for (const [pi, p] of cat.products.entries()) {
      const ex = byName.get(key(p.name));
      const rank = favorites.indexOf(p.name);
      const values = [p.name, p.description ?? "", p.price, JSON.stringify(p.tags ?? []), catId.get(cat.name), pi, rank >= 0 ? rank : null];
      let id: string;
      if (ex) {
        id = ex.id;
        kept.add(id);
        if (ex.name !== p.name) log(`~ ${ex.name} → ${p.name}`);
        if (Number(ex.price) !== p.price) log(`~ ${p.name}: ${Number(ex.price)} → ${p.price} TL`);
        await c.query(
          "UPDATE products SET name = ?, description = ?, price = ?, tags = ?, category_id = ?, sort_order = ?, favorite_rank = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
          [...values, id],
        );
      } else {
        id = randomUUID();
        log(`+ ${cat.name} › ${p.name} (${p.price} TL)`);
        await c.query(
          "INSERT INTO products (name, description, price, tags, category_id, sort_order, favorite_rank, id, cafe_id) VALUES (?,?,?,?,?,?,?,?,?)",
          [...values, id, cafeId],
        );
      }
      await c.query("DELETE FROM product_option_groups WHERE product_id = ?", [id]);
      for (const [gi, g] of (p.groups ?? []).entries()) {
        await c.query("INSERT INTO product_option_groups (cafe_id, product_id, group_id, sort_order) VALUES (?,?,?,?)", [cafeId, id, groupId.get(g), gi]);
      }
    }
  }
  for (const p of dbProds) {
    if (p.is_open_price || kept.has(p.id) || (!p.is_active && !p.category_id)) continue;
    log(`- ${p.name} (satıştan kalktı)`);
    await c.query("UPDATE products SET is_active = 0, category_id = NULL, favorite_rank = NULL WHERE id = ?", [p.id]);
  }

  // Boşalan eski kategoriler
  for (const cat of dbCats) {
    if ([...catId.values()].includes(cat.id)) continue;
    const [{ n }] = await rows<{ n: number }>(c, "SELECT COUNT(*) AS n FROM products WHERE category_id = ?", [cat.id]);
    if (Number(n) === 0) {
      log(`- kategori: ${cat.name}`);
      await c.query("DELETE FROM categories WHERE id = ?", [cat.id]);
    }
  }
}

async function main() {
  await loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tanımlı değil.");
  const apply = process.argv.includes("--apply");
  const pool = getPool();
  await migrateMysql(pool);
  const c = await pool.getConnection();
  try {
    const [cafe] = await rows<{ id: string }>(c, "SELECT id FROM cafes WHERE slug = ?", [OPIA_CAFE.slug]);
    if (!cafe) throw new Error("Opia kafesi yok; önce npm run setup:mysql çalıştır.");
    const changes: string[] = [];
    await c.beginTransaction();
    await sync(c, cafe.id, (s) => changes.push(s));
    if (apply) await c.commit();
    else await c.rollback();
    console.log(changes.length ? changes.join("\n") : "Menü zaten güncel.");
    console.log(apply ? `\n${changes.length} değişiklik uygulandı.` : `\nDeneme: hiçbir şey değişmedi. Uygulamak için: npm run menu:mysql -- --apply`);
  } catch (error) {
    await c.rollback().catch(() => {});
    throw error;
  } finally {
    c.release();
    await closePool();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
