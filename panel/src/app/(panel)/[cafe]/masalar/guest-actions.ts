"use server";

import { z } from "zod";
import type { GuestRequest } from "@/components/pos/guest-requests";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";

// QR masa siparişi bildirimleri (yalnızca MySQL sürümü)

export async function guestRequestsAction(cafeId: string): Promise<ActionResult<GuestRequest[]>> {
  try {
    return { ok: true, data: await rpc<GuestRequest[]>("pos_guest_requests", { p_cafe: z.uuid().parse(cafeId) }) };
  } catch (error) {
    return fail(error);
  }
}

export async function guestUpdateAction(cafeId: string, id: number, status: "hazirlaniyor" | "teslim" | "iptal"): Promise<ActionResult<GuestRequest[]>> {
  try {
    const input = z.object({ cafeId: z.uuid(), id: z.number().int().positive(), status: z.enum(["hazirlaniyor", "teslim", "iptal"]) }).parse({ cafeId, id, status });
    return { ok: true, data: await rpc<GuestRequest[]>("pos_guest_update", { p_cafe: input.cafeId, p_id: input.id, p_status: input.status }) };
  } catch (error) {
    return fail(error);
  }
}
