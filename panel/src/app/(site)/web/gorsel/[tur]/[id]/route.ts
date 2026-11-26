// Panelden yüklenen görseller (veritabanında durur): /gorsel/urun/<ürün id>, /gorsel/magaza/<mağaza ürünü id>.
// Adresteki ?v= sürümü her yüklemede değiştiği için uzun süre önbelleğe alınabilir.

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: Promise<{ tur: string; id: string }> }) {
  const { tur, id } = await params;
  const ok = tur === "alan" ? /^[a-z0-9-]{1,100}$/.test(id) : UUID.test(id) && (tur === "urun" || tur === "magaza");
  if (!process.env.DATABASE_URL || !ok) return new Response("Bulunamadı", { status: 404 });
  const { getMysql } = await import("@/lib/data/mysql/server");
  const { pool } = await getMysql();
  const sql =
    tur === "alan"
      ? "SELECT image, image_mime FROM site_images WHERE slot = ? LIMIT 1"
      : tur === "urun"
      ? "SELECT image, image_mime FROM site_products WHERE product_id = ? AND image_mode = 'custom'"
      : "SELECT image, image_mime FROM shop_items WHERE id = ? AND is_active = 1";
  const [rows] = (await pool.query(sql, [id])) as unknown as [{ image: Buffer | null; image_mime: string | null }[]];
  const row = rows[0];
  if (!row?.image || !row.image_mime) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(row.image), {
    headers: {
      "Content-Type": row.image_mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
