"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type LiveConfig = { mode: "local" } | { mode: "supabase"; url: string; key: string };

/** Realtime olayından gelen adisyon satırı (yalnızca ihtiyaç duyulan alanlar) */
export interface LiveChange {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  /** Yeni hâl (DELETE'te boş) */
  next: { id?: string; table_id?: string | null } | null;
  /** Eski hâl (yalnızca birincil anahtar gelir) */
  prev: { id?: string } | null;
}

/** Realtime bağlıyken güvenlik yoklaması; bağlantı yoksa daha sık */
const SAFETY_MS = 5 * 60_000;
const FALLBACK_MS = 30_000;

/**
 * Diğer cihazlardaki değişiklikleri yakalar. Supabase modunda Realtime ile
 * anlık (sunucuya istek yalnızca değişiklik olunca gider); yerel modda 5 sn'de
 * bir yoklama. Sekme yeniden görünür olunca da tetiklenir.
 *
 * Vercel kullanımını düşük tutmak için:
 *  - `relevant` ile ilgisiz olaylar elenir (ör. masa ekranı başka masayı yoksayar)
 *  - art arda gelen olaylar `debounceMs` içinde tek yenilemeye toplanır
 *  - Realtime bağlıyken güvenlik yoklaması 5 dakikada bir yapılır
 */
export function useLiveUpdates(
  cafeId: string,
  live: LiveConfig,
  onChange: () => void,
  options: { relevant?: (change: LiveChange) => boolean; debounceMs?: number } = {},
) {
  const callback = useRef(onChange);
  const relevant = useRef(options.relevant);
  useEffect(() => {
    callback.current = onChange;
    relevant.current = options.relevant;
  });

  const liveMode = live.mode;
  const liveUrl = live.mode === "supabase" ? live.url : "";
  const liveKey = live.mode === "supabase" ? live.key : "";
  const debounceMs = options.debounceMs ?? 600;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRun = Date.now();
    let connected = false;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastRun = Date.now();
        callback.current();
      }, debounceMs);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    document.addEventListener("visibilitychange", onVisible);

    let cleanup = () => {};
    if (liveMode === "supabase") {
      const onEvent = (payload: { eventType: LiveChange["eventType"]; new: Record<string, unknown>; old: Record<string, unknown> }) => {
        const change: LiveChange = {
          eventType: payload.eventType,
          next: payload.new && Object.keys(payload.new).length ? (payload.new as LiveChange["next"]) : null,
          prev: payload.old && Object.keys(payload.old).length ? (payload.old as LiveChange["prev"]) : null,
        };
        if (!relevant.current || relevant.current(change)) trigger();
      };
      const supabase = getBrowserSupabase(liveUrl, liveKey);
      const channel = supabase
        .channel(`orders-${cafeId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, onEvent)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, onEvent)
        .subscribe((status) => {
          const wasConnected = connected;
          connected = status === "SUBSCRIBED";
          // Bağlantı geri gelince arada kaçanları al
          if (connected && !wasConnected && Date.now() - lastRun > 5_000) trigger();
        });
      const safety = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        if (!connected || Date.now() - lastRun >= SAFETY_MS) trigger();
      }, FALLBACK_MS);
      cleanup = () => {
        clearInterval(safety);
        void supabase.removeChannel(channel);
      };
    } else {
      const poll = setInterval(onVisible, 5_000);
      cleanup = () => clearInterval(poll);
    }

    return () => {
      cleanup();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cafeId, liveMode, liveUrl, liveKey, debounceMs]);
}

/** Sunucu saatine göre düzeltilmiş "şimdi" (dakikada bir güncellenir) */
export function useServerNow(serverNow: string) {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    const interval = setInterval(tick, 20_000);
    return () => clearInterval(interval);
  }, [offset]);
  return now;
}

export function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}
