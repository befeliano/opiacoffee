import type { Metadata } from "next";
import { Floor } from "@/components/pos/floor";
import type { FloorData } from "@/lib/api/types";
import { getCafeContext } from "@/lib/data/cafe";
import type { GuestRequest } from "@/components/pos/guest-requests";
import { isMysqlMode, rpc } from "@/lib/data/server";
import { liveConfig } from "@/lib/live-config";

export const metadata: Metadata = { title: "Masalar" };

export default async function FloorPage({ params }: PageProps<"/[cafe]/masalar">) {
  const { cafe } = await params;
  const ctx = await getCafeContext(cafe);
  const [floor, guest] = await Promise.all([
    rpc<FloorData>("pos_floor", { p_cafe: ctx.cafe.id }),
    isMysqlMode().then((on) => (on ? rpc<GuestRequest[]>("pos_guest_requests", { p_cafe: ctx.cafe.id }) : null)),
  ]);

  return <Floor
      cafeId={ctx.cafe.id}
      slug={ctx.cafe.slug}
      cafeName={ctx.cafe.name}
      timezone={ctx.cafe.timezone}
      cashCount={ctx.cafe.cash_count}
      data={floor}
      live={liveConfig()}
      guest={guest}
    />;
}
