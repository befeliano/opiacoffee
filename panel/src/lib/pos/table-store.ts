"use client";

// Masa ekranları arasında paylaşılan istemci belleği.
// Masadan çıkıp tekrar girince son bilinen adisyon anında görünür; henüz
// sunucuya ulaşmamış eklemeler kaybolmaz, sırayla gönderilmeye devam eder.
// Salon ekranı da bu bellekten yararlanır: sunucudaki salon verisi henüz
// yetişmediyse masanın son hâli gösterilir.

import { useSyncExternalStore } from "react";
import type { FloorTable, Order, TableOrderData } from "@/lib/api/types";
import type { PendingOp } from "./optimistic";

export interface TableEntry {
  server: TableOrderData;
  pending: PendingOp[];
}

const entries = new Map<string, TableEntry>();
const optimistic = new Map<string, FloorTable["order"]>();
const listeners = new Set<() => void>();
let chain: Promise<void> = Promise.resolve();
let inflight = 0;
let seq = 1;
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function serverTime(data: TableOrderData) {
  return Date.parse(data.now) || 0;
}

/** Sunucudan gelen veriyi, eldekinden daha yeniyse belleğe yazar */
export function seedTable(initial: TableOrderData) {
  const current = entries.get(initial.table.id);
  if (!current) {
    entries.set(initial.table.id, { server: initial, pending: [] });
    return;
  }
  if (serverTime(initial) > serverTime(current.server)) {
    entries.set(initial.table.id, { ...current, server: initial });
  }
}

export function useTableEntry(tableId: string): TableEntry | undefined {
  return useSyncExternalStore(
    subscribe,
    () => entries.get(tableId),
    () => entries.get(tableId),
  );
}

export function setTableServer(data: TableOrderData) {
  const current = entries.get(data.table.id);
  entries.set(data.table.id, { server: data, pending: current?.pending ?? [] });
  emit();
}

export function setTableOrder(tableId: string, order: Order | null) {
  const current = entries.get(tableId);
  if (!current) return;
  entries.set(tableId, { ...current, server: { ...current.server, order } });
  emit();
}

export function tablePendingCount(tableId: string) {
  return entries.get(tableId)?.pending.length ?? 0;
}

/** Bekleyen tüm kayıtlar bitince çözülür */
export function whenIdle() {
  return chain;
}

export function isIdle() {
  return inflight === 0;
}

type OpInput = PendingOp extends infer T ? (T extends PendingOp ? Omit<T, "id" | "at"> : never) : never;

/**
 * İyimser işlem: ekranda hemen görünür, sunucuya sırayla gönderilir.
 * Bileşen ekrandan kalksa bile işlem tamamlanır ve bellek güncellenir.
 */
export function enqueueTableOp(
  tableId: string,
  input: OpInput,
  run: () => Promise<{ ok: true; data: TableOrderData } | { ok: false; error: string }>,
  onError: (message: string) => void,
) {
  const op = { ...input, id: seq++, at: Date.now() } as PendingOp;
  const current = entries.get(tableId);
  if (!current) return;
  entries.set(tableId, { ...current, pending: [...current.pending, op] });
  inflight += 1;
  emit();

  chain = chain.then(async () => {
    let result: Awaited<ReturnType<typeof run>>;
    try {
      result = await run();
    } catch {
      result = { ok: false, error: "Bağlantı sorunu. İnternetini kontrol edip tekrar dene." };
    }
    const entry = entries.get(tableId)!;
    const pending = entry.pending.filter((p) => p.id !== op.id);
    entries.set(tableId, result.ok ? { server: result.data, pending } : { ...entry, pending });
    inflight -= 1;
    if (!result.ok) onError(result.error);
    emit();
  });
}

// ---------------------------------------------------------------------
// Salon ekranı için masa özetleri
// ---------------------------------------------------------------------
function summarize(order: Order | null): FloorTable["order"] {
  if (!order || order.items.length + order.payments.length === 0) return null;
  return { id: order.id, opened_at: order.opened_at, total: order.total, paid: order.paid, items: order.items_count };
}

/** Masa ekranı, bekleyen işlemlerle birlikte gördüğü adisyonu buraya bildirir */
export function publishOptimistic(tableId: string, order: Order | null) {
  optimistic.set(tableId, summarize(order));
}

/**
 * Salon verisini, ondan daha yeni masa bilgileriyle birleştirir:
 * bekleyen işlem varsa ekrandaki hâl, yoksa sunucunun daha yeni yanıtı.
 */
export function mergeFloorTables(tables: FloorTable[], floorNow: string): FloorTable[] {
  if (entries.size === 0) return tables;
  const floorAt = Date.parse(floorNow) || 0;
  return tables.map((t) => {
    const entry = entries.get(t.id);
    if (!entry) return t;
    if (entry.pending.length > 0 && optimistic.has(t.id)) return { ...t, order: optimistic.get(t.id) ?? null };
    if (serverTime(entry.server) > floorAt) return { ...t, order: summarize(entry.server.order) };
    return t;
  });
}

export function useStoreVersion() {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

function getVersion() {
  return version;
}
