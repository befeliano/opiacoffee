"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Check,
  Coffee,
  FileSpreadsheet,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Table2,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/(panel)/giris/actions";
import { LogoMark } from "@/components/brand/logo";
import { DEMO_MODE } from "@/config";
import { Sheet } from "@/components/ui/sheet";
import { usePerms } from "./perms";
import { ThemeToggle } from "./theme-toggle";
import type { CafeSummary, CafeTheme, Role } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { nameLang } from "@/lib/format";

interface NavItem {
  segment: string;
  label: string;
  short: string;
  icon: LucideIcon;
  min: Role;
  /** Rolün yanında kişiye özel yetki şartı */
  perm?: "reports" | "menu";
}

const NAV: NavItem[] = [
  { segment: "masalar", label: "Masalar", short: "Masalar", icon: LayoutGrid, min: "staff" },
  { segment: "gecmis", label: "Geçmiş adisyonlar", short: "Geçmiş", icon: ReceiptText, min: "staff" },
  { segment: "rapor", label: "Raporlar", short: "Rapor", icon: BarChart3, min: "staff", perm: "reports" },
  { segment: "urunler", label: "Ürün satışları", short: "Ürünler", icon: Trophy, min: "staff", perm: "reports" },
  { segment: "analiz", label: "Analiz ve tahmin", short: "Analiz", icon: TrendingUp, min: "staff", perm: "reports" },
  { segment: "menu", label: "Menü ve maliyet", short: "Menü", icon: Coffee, min: "staff", perm: "menu" },
  { segment: "masa-duzeni", label: "Masa düzeni", short: "Masalar", icon: Table2, min: "staff", perm: "menu" },
  { segment: "z-raporu", label: "Z raporu", short: "Z raporu", icon: FileSpreadsheet, min: "owner" },
  { segment: "finans", label: "Finans", short: "Finans", icon: Wallet, min: "owner" },
  { segment: "ayarlar", label: "Ayarlar ve ekip", short: "Ayarlar", icon: Settings, min: "owner" },
];

const RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };
const ROLE_LABEL: Record<Role, string> = { owner: "Sahip", manager: "Müdür", staff: "Personel" };

export function AppNav({
  cafe,
  cafes,
  role,
  userLabel,
  localMode,
}: {
  cafe: { slug: string; name: string; theme: CafeTheme; logo?: string | null };
  cafes: CafeSummary[];
  role: Role;
  userLabel: string;
  localMode: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const perms = usePerms();
  const items = NAV.filter((i) => RANK[role] >= RANK[i.min] && (!i.perm || perms[i.perm]));
  const active = pathname.split("/")[2] ?? "masalar";
  const inOrderScreen = /^\/[^/]+\/masalar\/[^/]+/.test(pathname);

  const primary = items.filter((i) => ["masalar", "gecmis", "rapor", "menu"].includes(i.segment));
  const secondary = items.filter((i) => !primary.includes(i));

  return (
    <>
      {/* Tablet / masaüstü: ikonlu yan ray */}
      <nav className="fixed inset-y-0 left-0 z-30 hidden w-[84px] flex-col items-center border-r border-stone-200/80 bg-white py-3 md:flex">
        <Link href={`/${cafe.slug}/masalar`} className="relative mb-2" aria-label="Masalar">
          <LogoMark size={44} logo={cafe.logo} name={cafe.name} />
          {(localMode || DEMO_MODE) && (
            <span
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-stone-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
              title={localMode ? "Yerel geliştirme veritabanı" : "Test verisi yüklü — Ayarlar › Test verisi"}
            >
              {localMode ? "Yerel" : "Test"}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="mb-3 max-w-[76px] truncate rounded-lg px-1.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-700 hover:bg-brand-50"
          title={cafe.name}
          lang={nameLang(cafe.name)}
        >
          {shortName(cafe.name)}
        </button>
        <div className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto scrollbar-none px-2">
          {items.map((item) => (
            <RailLink key={item.segment} item={item} href={`/${cafe.slug}/${item.segment}`} active={active === item.segment} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="mt-2 grid size-11 place-items-center rounded-full bg-stone-900 text-[15px] font-bold text-white"
          aria-label="Hesap"
        >
          {userLabel.slice(0, 1).toUpperCase()}
        </button>
      </nav>

      {/* Mobil: üst çubuk */}
      {!inOrderScreen && (
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-stone-200/70 bg-white/90 px-4 pt-safe backdrop-blur md:hidden">
          <div className="flex h-14 flex-1 items-center gap-2.5">
            <LogoMark size={34} logo={cafe.logo} name={cafe.name} />
            <button type="button" onClick={() => setMoreOpen(true)} className="flex min-w-0 flex-col items-start leading-tight">
              <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-extrabold">
                <span className="truncate">{cafe.name}</span>
                {(localMode || DEMO_MODE) && <span className="rounded-full bg-stone-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">{localMode ? "Yerel" : "Test"}</span>}
              </span>
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-700">{ROLE_LABEL[role]}</span>
            </button>
          </div>
        </header>
      )}

      {/* Mobil: alt menü */}
      {!inOrderScreen && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/80 bg-white/95 pb-safe backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-lg items-stretch">
            {primary.map((item) => (
              <BottomLink key={item.segment} item={item} href={`/${cafe.slug}/${item.segment}`} active={active === item.segment} />
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold",
                secondary.some((i) => i.segment === active) ? "text-brand-700" : "text-stone-500",
              )}
            >
              <MoreHorizontal className="size-6" />
              Daha
            </button>
          </div>
        </nav>
      )}

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={cafe.name} description={`${userLabel} · ${ROLE_LABEL[role]}`} size="sm">
        {secondary.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 md:hidden">
            {secondary.map((item) => (
              <Link
                key={item.segment}
                href={`/${cafe.slug}/${item.segment}`}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-[14px] font-semibold",
                  active === item.segment ? "border-brand-300 bg-brand-50 text-brand-800" : "border-stone-200 text-stone-700",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {cafes.length > 1 && (
          <div className="mb-4">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-stone-400">Kafe değiştir</p>
            <ul className="flex flex-col gap-2">
              {cafes.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/${c.slug}/masalar`}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      c.slug === cafe.slug ? "border-brand-300 bg-brand-50" : "border-stone-200 hover:bg-stone-50",
                    )}
                  >
                    <LogoMark size={34} logo={c.logo} name={c.name} />
                    <span className="flex-1 text-[15px] font-semibold">{c.name}</span>
                    {c.slug === cafe.slug && <Check className="size-5 text-brand-600" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-stone-400">Görünüm</p>
          <ThemeToggle />
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 text-[15px] font-semibold text-stone-700 hover:bg-stone-50"
          >
            <LogOut className="size-5" />
            Çıkış yap
          </button>
        </form>
      </Sheet>
    </>
  );
}

function RailLink({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      title={item.label}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition",
        active ? "bg-brand-50 text-brand-700" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800",
      )}
    >
      <item.icon className={cn("size-[22px]", active && "text-brand-600")} strokeWidth={active ? 2.4 : 2} />
      <span className="leading-none">{item.short}</span>
    </Link>
  );
}

function BottomLink({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold",
        active ? "text-brand-700" : "text-stone-500",
      )}
    >
      {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-500" />}
      <item.icon className="size-6" strokeWidth={active ? 2.4 : 2} />
      {item.short}
    </Link>
  );
}

function shortName(name: string) {
  const first = name.split(/\s+/)[0] ?? name;
  return first.length > 9 ? first.slice(0, 8) + "…" : first;
}
