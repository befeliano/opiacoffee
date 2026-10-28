"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";

const id = z.uuid();

const expenseSchema = z
  .object({
    id: id.nullable(),
    kind: z.enum(["monthly", "one_time"]),
    category: z.enum(["kira", "fatura", "personel", "banka", "vergi", "ekipman", "pazarlama", "diger"]),
    name: z.string().trim().min(1).max(60),
    amount: z.number().min(0).max(99_999_999),
    starts_on: z.iso.date(),
    ends_on: z.iso.date().nullable(),
    note: z.string().trim().max(200),
  })
  .refine((e) => !e.ends_on || e.ends_on >= e.starts_on, "Bitiş, başlangıçtan önce olamaz");

export async function saveExpenseAction(cafeId: string, input: z.input<typeof expenseSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const data = expenseSchema.parse(input);
    const result = await rpc<{ id: string }>("finance_save_expense", { p_cafe: id.parse(cafeId), p_expense: data });
    refresh();
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteExpenseAction(cafeId: string, expenseId: string): Promise<ActionResult<void>> {
  try {
    await rpc<void>("finance_delete_expense", { p_cafe: id.parse(cafeId), p_id: id.parse(expenseId) });
    refresh();
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
