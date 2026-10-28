import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderScreen } from "@/components/pos/order-screen";
import type { FloorData, PosMenu, TableOrderData } from "@/lib/api/types";
import { getCafeContext } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { toAppError } from "@/lib/errors";
import { liveConfig } from "@/lib/live-config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = { title: "Adisyon" };

export default async function TablePage({ params }: PageProps<"/[cafe]/masalar/[table]">) {
  const { cafe, table } = await params;
  if (!UUID.test(table)) notFound();
  const ctx = await getCafeContext(cafe);

  const [menu, data, floor] = await Promise.all([
    rpc<PosMenu>("pos_menu", { p_cafe: ctx.cafe.id }),
    rpc<TableOrderData>("pos_table_order", { p_cafe: ctx.cafe.id, p_table: table }).catch((error) => {
      if (toAppError(error).code === "E_TABLE_NOT_FOUND") notFound();
      throw error;
    }),
    rpc<FloorData>("pos_floor", { p_cafe: ctx.cafe.id }),
  ]);

  return (
    <OrderScreen
      key={table}
      cafe={{ id: ctx.cafe.id, slug: ctx.cafe.slug, commissionRate: ctx.cafe.card_commission_rate, ticketCommissionRate: ctx.cafe.ticket_commission_rate ?? 0, timezone: ctx.cafe.timezone }}
      menu={menu}
      initial={data}
      floor={floor}
      live={liveConfig()}
    />
  );
}
