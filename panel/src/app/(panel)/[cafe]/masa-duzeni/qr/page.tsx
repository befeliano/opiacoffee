import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCafePerm } from "@/lib/data/cafe";
import { isMysqlMode, rpc } from "@/lib/data/server";
import { SITE } from "@/site/config";
import { QrView, type QrData } from "./qr-view";

export const metadata: Metadata = { title: "Masa QR kodları" };

export default async function QrPage({ params }: PageProps<"/[cafe]/masa-duzeni/qr">) {
  const { cafe } = await params;
  const ctx = await requireCafePerm(cafe, "menu");
  if (!(await isMysqlMode())) notFound();
  const data = await rpc<QrData>("tables_qr", { p_cafe: ctx.cafe.id });
  return <QrView cafeId={ctx.cafe.id} slug={ctx.cafe.slug} cafeName={ctx.cafe.name} siteUrl={SITE.url} data={data} />;
}
