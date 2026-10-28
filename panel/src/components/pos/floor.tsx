"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Clock3, ShoppingBag, UserPlus } from "lucide-react";
import { loadFloorAction } from "@/app/(panel)/[cafe]/masalar/actions";
import type { FloorData, FloorTable } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { nameLang, tl } from "@/lib/format";
import { formatMinutes } from "@/lib/domain/time";
import { mergeFloorTables, useStoreVersion } from "@/lib/pos/table-store";
import { DayBar } from "./day-controls";
import { GuestRequests, type GuestRequest } from "./guest-requests";
import { minutesSince, useLiveUpdates, useServerNow, type LiveConfig } from "./live";
import { TodayStats } from "./today-stats";
import { WeatherStrip } from "./weather-strip";

const LONG_STAY_MINUTES = 90;

export function Floor({
  cafeId,
  slug,
  cafeName,
  timezone,
  cashCount,
  data: serverData,
  live,
  guest,
}: {
  cafeId: string;
  slug: string;
  cafeName: string;
  timezone: string;
  /** Açılış/kapanışta kasa sayımı açık mı (açıksa gün çubuğu görünür) */
  cashCount: boolean;
  data: FloorData;
  live: LiveConfig;
  /** QR masa siparişi bildirimleri (yalnızca MySQL sürümünde; yoksa null) */
  guest?: GuestRequest[] | null;
}) {
  const router = useRouter();
  // Canlı güncellemede yalnızca salon verisi çekilir (sayfanın tamamı yeniden
  // çizilmez); sayfa yeniden yüklenince sunucudan gelen hâl esas alınır.
  const [fresh, setFresh] = useState<{ base: FloorData; data: FloorData }>({ base: serverData, data: serverData });
  const data = fresh.base === serverData ? fresh.data : serverData;
  const latestServerData = useRef(serverData);
  useEffect(() => {
    latestServerData.current = serverData;
  });
  const reload = useCallback(async () => {
    const result = await loadFloorAction(cafeId).catch(() => null);
    if (result?.ok) setFresh({ base: latestServerData.current, data: result.data });
    else router.refresh();
  }, [cafeId, router]);

  const now = useServerNow(data.now);
  const [area, setArea] = useState<string>("all");
  useLiveUpdates(cafeId, live, reload, { debounceMs: 1_000 });

  // Masa ekranında yapılan ve salon verisine henüz yansımamış değişiklikler
  const storeVersion = useStoreVersion();
  const tables = useMemo(() => mergeFloorTables(data.tables, data.now), [data, storeVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const occupied = tables.filter((t) => t.order && !t.is_takeaway);
  const dineTables = tables.filter((t) => !t.is_takeaway);
  const open = tables.reduce(
    (acc, t) => (t.order ? { total: acc.total + t.order.total, paid: acc.paid + t.order.paid, remaining: acc.remaining + Math.max(0, t.order.total - t.order.paid) } : acc),
    { total: 0, paid: 0, remaining: 0 },
  );
  const takeaways = tables.filter((t) => t.is_takeaway);

  const visible = useMemo(
    () => dineTables.filter((t) => area === "all" || t.area_id === area || (area === "none" && !t.area_id)),
    [dineTables, area],
  );
  const hasUnassigned = dineTables.some((t) => !t.area_id);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {/* Sol: başlık + altında hava şeridi; sağ: günün rakamları (tek satır kalsın) */}
        <div className="flex min-w-0 flex-col gap-2">
          <div>
            <p lang={nameLang(cafeName)} className="hidden text-[12px] font-bold uppercase tracking-[0.14em] text-brand-700 md:block">{cafeName}</p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">Masalar</h1>
          </div>
          <WeatherStrip cafeId={cafeId} live={live} />
        </div>
        <TodayStats today={data.today} open={open} occupied={occupied.length} total={dineTables.length} />
      </div>

      <BusyAlert tables={dineTables} now={now} />

      {guest && <GuestRequests cafeId={cafeId} slug={slug} initial={guest} onChange={reload} />}

      {cashCount && (
        <DayBar
          cafeId={cafeId}
          day={data.day}
          businessDate={data.business_date}
          timezone={timezone}
          openOrders={tables.filter((t) => t.order).length}
        />
      )}

      {data.areas.length > 1 && (
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 scrollbar-none">
          <AreaChip active={area === "all"} onClick={() => setArea("all")}>
            Tümü
          </AreaChip>
          {data.areas.map((a) => (
            <AreaChip key={a.id} active={area === a.id} onClick={() => setArea(a.id)}>
              {a.name}
            </AreaChip>
          ))}
          {hasUnassigned && (
            <AreaChip active={area === "none"} onClick={() => setArea("none")}>
              Alansız
            </AreaChip>
          )}
        </div>
      )}

      {takeaways.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {takeaways.map((t) => (
            <TakeawayTile key={t.id} table={t} href={`/${slug}/masalar/${t.id}`} now={now} />
          ))}
        </div>
      )}

      {dineTables.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          Henüz masa yok. Masa düzeni sayfasından masa ekleyebilirsin.
        </div>
      ) : area === "all" && data.areas.length > 1 ? (
        // Tümü: alanlara göre gruplu (Bahçe, Bar önü, Salon…)
        [...data.areas, ...(hasUnassigned ? [{ id: "none", name: "Diğer masalar" }] : [])].map((a) => {
          const group = dineTables.filter((t) => (a.id === "none" ? !t.area_id : t.area_id === a.id));
          if (group.length === 0) return null;
          const busy = group.filter((t) => t.order).length;
          return (
            <section key={a.id} className="mt-5">
              <h2 className="mb-2 flex items-baseline gap-2 text-[15px] font-bold text-stone-800">
                {a.name}
                <span className="text-[12px] font-semibold text-stone-400">
                  {busy}/{group.length} dolu
                </span>
              </h2>
              <TableGrid tables={group} slug={slug} now={now} />
            </section>
          );
        })
      ) : (
        <div className="mt-4">
          <TableGrid tables={visible} slug={slug} now={now} />
        </div>
      )}
    </main>
  );
}

function TableGrid({ tables, slug, now }: { tables: FloorTable[]; slug: string; now: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 min-[480px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
      {tables.map((t) => (
        <TableTile key={t.id} table={t} href={`/${slug}/masalar/${t.id}`} now={now} />
      ))}
    </div>
  );
}

function AreaChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition",
        active ? "bg-stone-900 text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300",
      )}
    >
      {children}
    </button>
  );
}

function TableTile({ table, href, now }: { table: FloorTable; href: string; now: number }) {
  const order = table.order;
  const minutes = order ? minutesSince(order.opened_at, now) : 0;
  const long = minutes >= LONG_STAY_MINUTES;

  return (
    <Link prefetch={false}
      href={href}
      className={cn(
        "group relative flex aspect-square flex-col justify-between rounded-2xl p-3 transition active:scale-[0.96] sm:p-3.5",
        order
          ? "bg-brand-500 text-white shadow-[0_8px_20px_-8px_rgb(254_107_2/0.7)] hover:bg-brand-600"
          : "border border-stone-200 bg-white text-stone-900 shadow-card hover:border-brand-300",
      )}
    >
      <span className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "truncate font-extrabold leading-none tracking-tight",
            table.name.length > 5 ? "text-[17px] sm:text-[19px]" : "text-[22px] sm:text-[24px]",
          )}
        >
          {table.name}
        </span>
        {long && <Clock3 className="size-4 shrink-0 text-white/90" aria-label="Uzun süredir açık" />}
      </span>
      {order ? (
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold leading-tight tabular-nums">{tl(order.total, { decimals: "never" })}</span>
          <span className="text-[12px] font-medium leading-tight text-white/85">
            {formatMinutes(minutes)} · {order.items} ürün
          </span>
        </span>
      ) : (
        <span className="text-[13px] font-medium text-stone-400">Boş</span>
      )}
    </Link>
  );
}

function TakeawayTile({ table, href, now }: { table: FloorTable; href: string; now: number }) {
  const order = table.order;
  return (
    <Link prefetch={false}
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-3.5 transition active:scale-[0.98]",
        order ? "bg-stone-900 text-white" : "border border-dashed border-stone-300 bg-white hover:border-brand-400",
      )}
    >
      <span className={cn("grid size-11 place-items-center rounded-xl", order ? "bg-brand-500" : "bg-brand-50 text-brand-600")}>
        <ShoppingBag className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block text-[16px] font-bold">{table.name}</span>
        <span className={cn("text-[13px]", order ? "text-stone-300" : "text-stone-500")}>
          {order ? `${order.items} ürün · ${formatMinutes(minutesSince(order.opened_at, now))}` : "Paket / ayakta sipariş"}
        </span>
      </span>
      {order && <span className="text-[17px] font-extrabold tabular-nums">{tl(order.total, { decimals: "never" })}</span>}
    </Link>
  );
}

/** Kısa sürede bu kadar masa açılırsa yoğunluk uyarısı */
const BURST_TABLES = 4;
const BURST_MINUTES = 15;
/** Aynı anda bu kadar dolu masa varsa da uyar */
const BUSY_TABLES = 8;
const SNOOZE_MS = 30 * 60_000;
const SNOOZE_KEY = "ad_busy_snooze";

/**
 * Yoğunluk uyarısı: son 15 dakikada 4+ masa açıldıysa ya da 8+ masa doluysa
 * "yardım çağırmak isteyebilirsin" der. "Tamam" o cihazda 30 dk susturur.
 */
function readSnooze() {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function BusyAlert({ tables, now }: { tables: FloorTable[]; now: number }) {
  // Sunucuda 0 (susturma yok), tarayıcıda cihazdaki değer — ilk çizimde uyumsuzluk olmasın
  const stored = useSyncExternalStore(noopSubscribe, readSnooze, () => 0);
  const [snoozedLocal, setSnoozedUntil] = useState(0);
  const snoozedUntil = Math.max(stored, snoozedLocal);
  const busy = tables.filter((t) => t.order);
  const burst = busy.filter((t) => minutesSince(t.order!.opened_at, now) < BURST_MINUTES).length;
  const show = (burst >= BURST_TABLES || busy.length >= BUSY_TABLES) && now > snoozedUntil;
  if (!show) return null;

  const snooze = () => {
    const until = Date.now() + SNOOZE_MS;
    setSnoozedUntil(until);
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      // depolama kapalı olabilir
    }
  };

  return (
    <div role="status" className="mt-4 flex animate-fade-in items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-950">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
        <UserPlus className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold leading-tight">Yoğunluk artıyor — yardım çağırmak isteyebilirsin</span>
        <span className="block text-[13px] text-violet-800">
          {burst >= BURST_TABLES ? `Son ${BURST_MINUTES} dakikada ${burst} masa açıldı` : `${busy.length} masa dolu`}
          {burst >= BURST_TABLES && busy.length >= BUSY_TABLES ? ` · ${busy.length} masa dolu` : ""}
        </span>
      </span>
      <button type="button" onClick={snooze} className="h-10 shrink-0 rounded-xl bg-violet-600 px-3.5 text-[14px] font-bold text-white hover:bg-violet-700">
        Tamam
      </button>
    </div>
  );
}

const noopSubscribe = () => () => {};
