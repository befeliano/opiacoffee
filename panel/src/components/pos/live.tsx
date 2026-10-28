"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type LiveConfig = { mode: "local" } | { mode: "supabase"; url: string; key: string };

/**
 * Diğer cihazlardaki değişiklikleri yakalar. Supabase modunda Realtime ile
 * anlık; yerel modda 5 sn'de bir yoklama. Sekme görünür olduğunda ve odak
 * geri geldiğinde de tetiklenir.
 */
export function useLiveUpdates(cafeId: string, live: LiveConfig, onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });

  const liveMode = live.mode;
  const liveUrl = live.mode === "supabase" ? live.url : "";
  const liveKey = live.mode === "supabase" ? live.key : "";

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), 250);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", trigger);

    let cleanup = () => {};
    if (liveMode === "supabase") {
      const supabase = getBrowserSupabase(liveUrl, liveKey);
      const channel = supabase
        .channel(`orders-${cafeId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` }, trigger)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, trigger)
        .subscribe();
      const safety = setInterval(onVisible, 60_000);
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
      window.removeEventListener("focus", trigger);
    };
  }, [cafeId, liveMode, liveUrl, liveKey]);
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
