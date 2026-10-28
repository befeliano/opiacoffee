"use server";

import { z } from "zod";
import type { RainRow } from "@/components/pos/rain-alert";
import { isMysqlMode, rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";
import { RAIN_INTERVAL_MS, refreshRainIfDue } from "@/lib/rain/check";

// Yağmur uyarısı (Supabase dışı sürümler): tabletler dakikada bir okur.
// MySQL sürümünde son ölçüm eskiyse radar burada yeniden ölçülür.

export async function rainStatusAction(cafeId: string): Promise<ActionResult<RainRow | null>> {
  try {
    const cafe = z.uuid().parse(cafeId);
    let row = await rpc<RainRow | null>("rain_get", { p_cafe: cafe });
    if ((await isMysqlMode()) && (!row || Date.now() - Date.parse(row.checked_at) > RAIN_INTERVAL_MS)) {
      await refreshRainIfDue();
      row = await rpc<RainRow | null>("rain_get", { p_cafe: cafe });
    }
    return { ok: true, data: row };
  } catch (error) {
    return fail(error);
  }
}

export async function rainAckAction(cafeId: string): Promise<ActionResult<null>> {
  try {
    await rpc("rain_ack", { p_cafe: z.uuid().parse(cafeId) });
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
