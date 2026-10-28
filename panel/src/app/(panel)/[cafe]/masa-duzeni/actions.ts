"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";

const id = z.uuid();

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function saveAreaAction(cafeId: string, input: { id: string | null; name: string }) {
  return run(async () => {
    const data = z.object({ id: id.nullable(), name: z.string().trim().min(1).max(40) }).parse(input);
    return rpc<{ id: string }>("tables_save_area", { p_cafe: id.parse(cafeId), p_area: data });
  });
}

export async function deleteAreaAction(cafeId: string, areaId: string) {
  return run(() => rpc<void>("tables_delete_area", { p_cafe: id.parse(cafeId), p_id: id.parse(areaId) }));
}

const tableSchema = z.object({
  id: id.nullable(),
  name: z.string().trim().min(1).max(24),
  area_id: id.nullable(),
  is_takeaway: z.boolean(),
  is_active: z.boolean(),
});

export async function saveTableAction(cafeId: string, input: z.input<typeof tableSchema>) {
  return run(async () => {
    const data = tableSchema.parse(input);
    return rpc<{ id: string }>("tables_save_table", { p_cafe: id.parse(cafeId), p_table: data });
  });
}

export async function deleteTableAction(cafeId: string, tableId: string) {
  return run(() => rpc<void>("tables_delete_table", { p_cafe: id.parse(cafeId), p_id: id.parse(tableId) }));
}

export async function bulkCreateTablesAction(cafeId: string, input: { areaId: string | null; prefix: string; from: number; to: number }) {
  return run(async () => {
    const data = z
      .object({ areaId: id.nullable(), prefix: z.string().trim().max(12), from: z.int().min(0).max(9999), to: z.int().min(0).max(9999) })
      .refine((v) => v.to >= v.from && v.to - v.from < 100, "Aralık en fazla 100 masa olabilir")
      .parse(input);
    return rpc<{ created: number }>("tables_bulk_create", {
      p_cafe: id.parse(cafeId),
      p_area: data.areaId,
      p_prefix: data.prefix,
      p_from: data.from,
      p_to: data.to,
    });
  });
}

export async function reorderTablesAction(cafeId: string, kind: "areas" | "tables", ids: string[]) {
  return run(async () => {
    const parsed = z.object({ kind: z.enum(["areas", "tables"]), ids: z.array(id).max(500) }).parse({ kind, ids });
    return rpc<void>("menu_reorder", { p_cafe: id.parse(cafeId), p_kind: parsed.kind, p_ids: parsed.ids });
  });
}
