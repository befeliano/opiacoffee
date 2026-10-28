"use client";

import { useEffect, useState } from "react";
import { CloudRain, Umbrella } from "lucide-react";
import { rainAckAction, rainStatusAction } from "@/app/(panel)/[cafe]/rain-actions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { LiveConfig } from "./live";

/** Supabase dışı sürümlerde (yerel, MySQL) durum bu aralıkla sunucudan okunur */
const POLL_MS = 60_000;

export interface RainRow {
  cafe_id: string;
  checked_at: string;
  stale: boolean;
  eta_min: number | null;
  nearest_km: number | null;
  speed_kmh: number | null;
  from_deg: number | null;
  alert_since: string | null;
  ack_at: string | null;
}

const DIRS = ["kuzeyden", "kuzeydoğudan", "doğudan", "güneydoğudan", "güneyden", "güneybatıdan", "batıdan", "kuzeybatıdan"];
/** Ölçüm bundan eskiyse (radar kontrolü durmuş) uyarı gösterilmez */
const MAX_AGE_MS = 25 * 60_000;

/**
 * Yağmur uyarısı: radar kontrolünün sonucunu (rain_status) Supabase sürümünde
 * Realtime ile, yerel ve MySQL sürümünde sunucu eylemiyle (dakikada bir) okur.
 * "Masaları topladık" uyarıyı o kafedeki bütün cihazlarda kapatır.
 */
export function RainAlert({ cafeId, live }: { cafeId: string; live: LiveConfig }) {
  const [row, setRow] = useRainStatus(cafeId, live, "alert");
  const [now, setNow] = useState(() => Date.now());
  const [acking, setAcking] = useState(false);

  const url = live.mode === "supabase" ? live.url : "";
  const key = live.mode === "supabase" ? live.key : "";

  // Geri sayım (ağ isteği yok)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const checkedAt = row ? Date.parse(row.checked_at) : 0;
  const visible = !!row && !!row.alert_since && !row.ack_at && !row.stale && now - checkedAt < MAX_AGE_MS;

  useEffect(() => {
    if (visible) navigator.vibrate?.([200, 100, 200]);
  }, [visible]);

  if (!visible || !row) return null;

  const elapsed = (now - checkedAt) / 60_000;
  const remaining = Math.max(0, Math.round((row.eta_min ?? 0) - elapsed));
  const dir = row.from_deg !== null ? DIRS[Math.round(row.from_deg / 45) % 8] : null;
  const details = [dir && `${dir} geliyor`, row.speed_kmh ? `${row.speed_kmh} km/s` : null, row.nearest_km !== null ? `en yakın ${row.nearest_km} km` : null]
    .filter(Boolean)
    .join(" · ");

  const acknowledge = async () => {
    setAcking(true);
    setRow((r) => (r ? { ...r, ack_at: new Date().toISOString() } : r)); // hemen kapat; Realtime diğer cihazlara yayar
    const failed = url
      ? !!(await getBrowserSupabase(url, key).rpc("rain_ack", { p_cafe: cafeId })).error
      : !(await rainAckAction(cafeId)).ok;
    if (failed) setRow((r) => (r ? { ...r, ack_at: null } : r));
    setAcking(false);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-safe md:pl-[96px]">
      <div
        role="alert"
        className="pointer-events-auto mt-2 flex w-full max-w-2xl animate-fade-in items-center gap-3 rounded-2xl bg-amber-400 px-4 py-3 text-stone-950 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.45)]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-stone-950/10">
          <CloudRain className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold leading-tight sm:text-[16px]">
            {remaining === 0 ? "Yağmur başladı ya da başlamak üzere — şemsiyeleri toplayın!" : `~${remaining} dk içinde yağmur bekleniyor — şemsiyeleri toplayın`}
          </span>
          {details && <span className="block truncate text-[13px] font-medium text-stone-800">{details}</span>}
        </span>
        <button
          type="button"
          onClick={acknowledge}
          disabled={acking}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-stone-950 px-3.5 text-[14px] font-bold text-white hover:bg-stone-800 disabled:opacity-60"
        >
          <Umbrella className="size-4" /> Topladık
        </button>
      </div>
    </div>
  );
}

/**
 * Kafenin radar durumu (rain_status): Supabase sürümünde doğrudan Supabase'den okunur ve
 * Realtime ile dinlenir. `tag` aynı sayfada birden fazla dinleyici olursa
 * kanal adları çakışmasın diye.
 */
export function useRainStatus(cafeId: string, live: LiveConfig, tag: string) {
  const [row, setRow] = useState<RainRow | null>(null);
  const url = live.mode === "supabase" ? live.url : "";
  const key = live.mode === "supabase" ? live.key : "";

  useEffect(() => {
    if (!url) {
      // Supabase yok: sunucudan dakikada bir oku (MySQL sürümünde radar ölçümü de orada tetiklenir)
      let alive = true;
      const load = async () => {
        if (document.visibilityState !== "visible") return;
        const res = await rainStatusAction(cafeId).catch(() => null);
        if (alive && res?.ok) setRow(res.data);
      };
      void load();
      const timer = setInterval(load, POLL_MS);
      document.addEventListener("visibilitychange", load);
      return () => {
        alive = false;
        clearInterval(timer);
        document.removeEventListener("visibilitychange", load);
      };
    }
    const supabase = getBrowserSupabase(url, key);
    let alive = true;
    const load = () =>
      supabase
        .from("rain_status")
        .select("*")
        .eq("cafe_id", cafeId)
        .maybeSingle()
        .then(({ data }) => alive && setRow((data as RainRow | null) ?? null));
    void load();
    const channel = supabase
      .channel(`rain-${tag}-${cafeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rain_status", filter: `cafe_id=eq.${cafeId}` }, (payload) => {
        if (payload.new && "cafe_id" in payload.new) setRow(payload.new as RainRow);
      })
      .subscribe();
    // Sekme uyuyup uyanınca kaçan güncellemeyi al
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [cafeId, url, key, tag]);

  return [row, setRow] as const;
}
