"use server";

import { z } from "zod";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";
import type { QrData } from "./qr-view";

// Masa QR kodları (yalnızca MySQL sürümü)

export async function resetQrAction(cafeId: string, tableId: string): Promise<ActionResult<QrData>> {
  try {
    const input = z.object({ cafeId: z.uuid(), tableId: z.uuid() }).parse({ cafeId, tableId });
    return { ok: true, data: await rpc<QrData>("tables_qr_reset", { p_cafe: input.cafeId, p_table: input.tableId }) };
  } catch (error) {
    return fail(error);
  }
}

export async function setQrOrderingAction(cafeId: string, on: boolean): Promise<ActionResult<QrData>> {
  try {
    return { ok: true, data: await rpc<QrData>("cafe_set_qr_ordering", { p_cafe: z.uuid().parse(cafeId), p_on: z.boolean().parse(on) }) };
  } catch (error) {
    return fail(error);
  }
}
