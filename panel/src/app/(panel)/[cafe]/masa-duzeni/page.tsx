import type { Metadata } from "next";
import { TablesManager } from "@/components/tables/tables-manager";
import type { TablesAdminData } from "@/lib/api/types";
import { requireCafePerm } from "@/lib/data/cafe";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { isMysqlMode, rpc } from "@/lib/data/server";

export const metadata: Metadata = { title: "Masa düzeni" };

export default async function TablesPage({ params }: PageProps<"/[cafe]/masa-duzeni">) {
  const { cafe } = await params;
  const ctx = await requireCafePerm(cafe, "menu");
  const data = await rpc<TablesAdminData>("tables_admin_data", { p_cafe: ctx.cafe.id });
  const qr = await isMysqlMode();
  return (
    <>
      {qr && (
        <div className="mx-auto flex max-w-6xl justify-end px-4 pt-4 sm:px-6">
          <Link href={`/${ctx.cafe.slug}/masa-duzeni/qr`} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold shadow-card">
            <QrCode className="size-4" aria-hidden /> Masa QR kodları
          </Link>
        </div>
      )}
      <TablesManager cafeId={ctx.cafe.id} data={data} />
    </>
  );
}
