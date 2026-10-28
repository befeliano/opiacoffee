/**
 * Supabase kurulumu: kafeleri, menüleri, masaları ve ekip hesaplarını oluşturur.
 *
 *   npm run setup            → gerçek kurulum (boş, satış verisi yok)
 *   npm run setup -- --demo  → üstüne tanıtım için test verisi yükler
 *
 * Tekrar çalıştırmak güvenlidir: var olan kafe ve hesaplar atlanır.
 * Test verisi uygulamadan tek tuşla silinebilir (Ayarlar › Test verisi).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CAFES, DEFAULT_CARD_COMMISSION, DEFAULT_TIMEZONE, buildCafePayload, type CafeDef, type SeedIds } from "../src/lib/seed/menus";
import { generateDemoOrders } from "../src/lib/seed/demo";
import { demoExpenses } from "../src/lib/seed/expenses";
import { TEAM } from "../src/lib/seed/team";

const DEMO_DAYS = 60;

async function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  try {
    const text = await readFile(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // .env.local yoksa ortam değişkenlerine bakılır
  }
}

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Tanıtım için örnek alış fiyatları, satış geçmişi ve sabit giderler */
async function seedDemo(admin: SupabaseClient, def: CafeDef, cafeId: string, seed: number) {
  // 1) Alış fiyatları (maliyet ve kâr rakamları anlamlı görünsün)
  const fixedCostProducts = def.categories.flatMap((c) =>
    c.products
      .filter((p) => (p.fixed || !p.recipe?.length) && p.demoCost)
      .map((p) => ({ name: p.name, fixed_cost: p.demoCost ?? 0 })),
  );
  await callRpc(admin, "admin_apply_prices", {
    p_cafe: cafeId,
    p_payload: {
      ingredients: def.ingredients.map((i) => ({ name: i.name, package_price: i.demoPrice })),
      products: fixedCostProducts,
    },
  });

  // 2) Veritabanındaki gerçek kimlikleri al, tohum verisindeki ağırlıklarla birleştir
  const ids = await callRpc<SeedIds>(admin, "admin_cafe_seed_ids", { p_cafe: cafeId });
  const weights = new Map(def.categories.flatMap((c) => c.products.map((p) => [p.name, p.demoWeight ?? 1] as const)));
  const shares = new Map(def.groups.flatMap((g) => g.options.map((o) => [o.name, o.demoShare ?? 0] as const)));
  const withWeights: SeedIds = {
    ...ids,
    products: ids.products.map((p) => ({ ...p, weight: weights.get(p.name) ?? 1 })),
    groups: ids.groups.map((g) => ({ ...g, options: g.options.map((o) => ({ ...o, share: shares.get(o.name) ?? 0 })) })),
  };

  // 3) Satış geçmişi
  const demo = generateDemoOrders(def, withWeights, {
    days: DEMO_DAYS,
    now: new Date(),
    tz: def.timezone ?? DEFAULT_TIMEZONE,
    seed,
    commissionRate: def.cardCommissionRate ?? DEFAULT_CARD_COMMISSION,
    uuid: randomUUID,
  });

  const chunk = 250;
  for (let i = 0; i < demo.orders.length; i += chunk) {
    const orders = demo.orders.slice(i, i + chunk);
    const orderIds = new Set(orders.map((o) => o.id));
    await callRpc(admin, "admin_import_orders", {
      p_cafe: cafeId,
      p_payload: {
        orders,
        items: demo.items.filter((it) => orderIds.has(it.order_id)),
        payments: demo.payments.filter((p) => orderIds.has(p.order_id)),
      },
    });
    process.stdout.write(`\r  · ${def.name}: ${Math.min(i + chunk, demo.orders.length)}/${demo.orders.length} adisyon`);
  }
  process.stdout.write("\n");

  // 4) Sabit giderler (finans ve başabaş ekranları dolu görünsün)
  const expenses = demoExpenses();
  await callRpc(admin, "admin_import_expenses", { p_cafe: cafeId, p_payload: { expenses } });
  console.log(`  · ${def.name}: ${demo.orders.length} adisyon, ${demo.items.length} satır, ${expenses.length} gider yüklendi`);
}

async function main() {
  await loadEnv();
  const withDemo = process.argv.includes("--demo");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL tanımlı değil (.env.local).");
  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY tanımlı değil.\n" +
        "Supabase panelinde: Project Settings › API Keys › secret key (sb_secret_… ile başlar)\n" +
        "Bu anahtarı .env.local dosyasına ekle ve kimseyle paylaşma.",
    );
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const created: { email: string; name: string; password: string }[] = [];
  const userIds = new Map<string, string>();

  // 1) Hesaplar
  const { data: existingList, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) throw new Error(`Kullanıcılar okunamadı: ${listError.message}`);
  const existing = new Map((existingList?.users ?? []).map((u) => [(u.email ?? "").toLowerCase(), u.id]));

  for (const member of TEAM) {
    const email = member.email.toLowerCase();
    const found = existing.get(email);
    if (found) {
      userIds.set(email, found);
      console.log(`· hesap var    ${email}`);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: member.password,
      email_confirm: true,
      user_metadata: { display_name: member.name },
    });
    if (error || !data.user) throw new Error(`Hesap oluşturulamadı (${email}): ${error?.message}`);
    userIds.set(email, data.user.id);
    created.push({ email, name: member.name, password: member.password });
    console.log(`+ hesap açıldı ${email}`);
  }

  // 2) Kafeler, menüler, masalar
  const firstOwner = TEAM.find((m) => m.memberships.some((x) => x.role === "owner"));
  const ownerId = firstOwner ? userIds.get(firstOwner.email.toLowerCase()) : undefined;
  let seed = 20260918;

  for (const def of CAFES) {
    let cafeId = await callRpc<string | null>(admin, "admin_cafe_by_slug", { p_slug: def.slug });

    if (cafeId) {
      console.log(`· kafe var     ${def.name}`);
    } else {
      // Gerçek kurulumda maliyetler boş gelir; sahibi kendi alış fiyatlarını girer
      const { payload } = buildCafePayload(def, { demo: false, uuid: randomUUID });
      const result = await callRpc<{ cafe_id: string }>(admin, "admin_create_cafe", {
        p_owner: ownerId ?? null,
        p_owner_name: firstOwner?.name ?? "",
        p_payload: payload,
      });
      cafeId = result.cafe_id;
      const productCount = def.categories.reduce((s, c) => s + c.products.length, 0);
      console.log(`+ kafe kuruldu ${def.name} (${productCount} ürün, ${def.areas.reduce((s, a) => s + a.tables.length, 0)} masa)`);
    }

    for (const member of TEAM) {
      const membership = member.memberships.find((m) => m.slug === def.slug);
      if (!membership) continue;
      await callRpc(admin, "admin_add_member", {
        p_cafe: cafeId,
        p_user: userIds.get(member.email.toLowerCase()),
        p_role: membership.role,
        p_display_name: member.name,
      });
    }

    if (withDemo) {
      const ids = await callRpc<SeedIds & { demoOrders: number }>(admin, "admin_cafe_seed_ids", { p_cafe: cafeId });
      if (ids.demoOrders > 0) {
        console.log(`· ${def.name}: ${ids.demoOrders} test adisyonu zaten var, atlandı`);
      } else {
        await seedDemo(admin, def, cafeId, seed++);
      }
    }
  }

  console.log("\nKurulum tamam.\n");
  if (created.length > 0) {
    console.log("Hesaplar:\n");
    const width = Math.max(...created.map((c) => c.email.length));
    for (const c of created) console.log(`  ${c.name.padEnd(9)} ${c.email.padEnd(width)}  ${c.password}`);
    console.log("\nŞifreler Ayarlar › Ekip ekranından değiştirilebilir.");
  } else {
    console.log("Tüm hesaplar zaten vardı, şifrelere dokunulmadı.");
  }
  if (withDemo) {
    console.log("\nTest verisi yüklendi. Silmek için: uygulamada Ayarlar › Test verisi › 'Test verilerini sil'");
    console.log("Ardından src/config.ts içindeki DEMO_MODE değerini false yap.");
  }
}

main().catch((error) => {
  console.error("\nKurulum başarısız:\n", error instanceof Error ? error.message : error);
  process.exit(1);
});
