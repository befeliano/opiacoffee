import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import type { TeamMember } from "@/lib/api/types";
import { requireCafeRole } from "@/lib/data/cafe";
import { isLocalMode, rpc } from "@/lib/data/server";
import { DEMO_MODE } from "@/config";

export const metadata: Metadata = { title: "Ayarlar ve ekip" };
// Test verisini yenileme birkaç bin adisyon yazar
export const maxDuration = 60;

export default async function SettingsPage({ params }: PageProps<"/[cafe]/ayarlar">) {
  const { cafe } = await params;
  const ctx = await requireCafeRole(cafe, "owner");
  const [team, local, demo] = await Promise.all([
    rpc<TeamMember[]>("team_list", { p_cafe: ctx.cafe.id }),
    isLocalMode(),
    DEMO_MODE
      ? rpc<{ orders: number; expenses: number; real_orders: number }>("demo_status", { p_cafe: ctx.cafe.id })
      : Promise.resolve(null),
  ]);
  return <SettingsView ctx={ctx} team={team} localMode={local} demo={demo} />;
}
