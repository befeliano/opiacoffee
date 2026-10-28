// Yağmur uyarısı (Postgres'teki 20261029120000_rain_alert.sql karşılığı).
// Ölçümü src/lib/rain/check.ts yapar ve rain_report ile yazar; tabletler rain_get ile okur.

import type { Ctx, Row } from "./db";
import { bit, cleanText, fail, iso, requireRole, requireService, uuid } from "./helpers";

const COOLDOWN_MS = 30 * 60_000;

function rowJson(r: Row | null) {
  if (!r) return null;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    cafe_id: r.cafe_id,
    checked_at: iso(r.checked_at),
    frame_at: iso(r.frame_at),
    frame_age_min: n(r.frame_age_min),
    stale: bit(r.stale),
    eta_min: n(r.eta_min),
    nearest_km: n(r.nearest_km),
    speed_kmh: n(r.speed_kmh),
    from_deg: n(r.from_deg),
    alert_since: iso(r.alert_since),
    last_alert_seen: iso(r.last_alert_seen),
    ack_at: iso(r.ack_at),
    ack_by: r.ack_by ?? "",
  };
}

/** Radarla kontrol edilecek kafeler (yalnızca servis rolü) */
export async function rain_targets(ctx: Ctx) {
  requireService(ctx);
  const rows = await ctx.all("SELECT id, lat, lon, rain_warn_min FROM cafes WHERE lat IS NOT NULL AND lon IS NOT NULL ORDER BY slug");
  return rows.map((r) => ({ cafe_id: r.id, lat: Number(r.lat), lon: Number(r.lon), warn_min: Number(r.rain_warn_min) }));
}

/** Ölçümü yazar ve uyarı yaşam döngüsünü yürütür (yalnızca servis rolü) */
export async function rain_report(ctx: Ctx, a: Row) {
  requireService(ctx);
  const cafe = uuid(a.p_cafe);
  const s = (typeof a.p_status === "string" ? JSON.parse(a.p_status) : a.p_status) as Row;
  if (!s || typeof s !== "object") fail("E_INVALID_INPUT");
  const alert = s.alert === true;

  await ctx.run("INSERT IGNORE INTO rain_status (cafe_id, checked_at) VALUES (?, ?)", [cafe, ctx.now]);
  const row = (await ctx.one("SELECT * FROM rain_status WHERE cafe_id = ? FOR UPDATE", [cafe]))!;
  let alertSince: Date | null = row.alert_since;
  let lastSeen: Date | null = row.last_alert_seen;
  let ackAt: Date | null = row.ack_at;
  let ackBy: string = row.ack_by ?? "";
  if (alert) {
    lastSeen = ctx.now;
    if (!alertSince) {
      alertSince = ctx.now;
      ackAt = null;
      ackBy = "";
    }
  } else if (alertSince && ctx.now.getTime() - new Date(lastSeen ?? alertSince).getTime() > COOLDOWN_MS) {
    alertSince = null;
    ackAt = null;
    ackBy = "";
  }

  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const int = (v: unknown) => (num(v) === null ? null : Math.round(Number(v)));
  await ctx.run(
    `UPDATE rain_status SET checked_at = ?, frame_at = ?, frame_age_min = ?, stale = ?, eta_min = ?, nearest_km = ?,
       speed_kmh = ?, from_deg = ?, alert_since = ?, last_alert_seen = ?, ack_at = ?, ack_by = ? WHERE cafe_id = ?`,
    [
      ctx.now,
      num(s.frameTime) === null ? null : new Date(Number(s.frameTime) * 1000),
      num(s.frameAgeMin) === null ? null : Math.round(Number(s.frameAgeMin) * 10) / 10,
      s.stale === true ? 1 : 0,
      int(s.etaMin),
      num(s.nearestKm) === null ? null : Math.round(Number(s.nearestKm) * 10) / 10,
      int(s.speedKmh),
      int(s.fromDeg),
      alertSince,
      lastSeen,
      ackAt,
      ackBy,
      cafe,
    ],
  );
  return rowJson(await ctx.one("SELECT * FROM rain_status WHERE cafe_id = ?", [cafe]));
}

/** Tabletlerin okuduğu son durum */
export async function rain_get(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  return rowJson(await ctx.one("SELECT * FROM rain_status WHERE cafe_id = ?", [cafe]));
}

/** "Masaları topladık": uyarıyı o kafedeki bütün cihazlarda kapatır */
export async function rain_ack(ctx: Ctx, a: Row) {
  const cafe = uuid(a.p_cafe);
  await requireRole(ctx, cafe, "staff");
  const name = await ctx.val<string>("SELECT display_name FROM cafe_members WHERE cafe_id = ? AND user_id = ?", [cafe, ctx.uid]);
  await ctx.run(
    "UPDATE rain_status SET ack_at = ?, ack_by = ? WHERE cafe_id = ? AND alert_since IS NOT NULL AND ack_at IS NULL",
    [ctx.now, cleanText(name ?? "", 60), cafe],
  );
  return null;
}
