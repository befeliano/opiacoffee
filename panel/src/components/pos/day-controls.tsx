"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, DoorClosed, DoorOpen, Sunrise, Ticket } from "lucide-react";
import { dayCloseAction, dayOpenAction, dayStatusAction } from "@/app/(panel)/[cafe]/masalar/actions";
import { Button, Spinner } from "@/components/ui/button";
import { Field, NumberInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { CafeDay, DayCloseResult, DayStatus, FloorData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/domain/time";
import { tl, currencySymbol } from "@/lib/format";

/**
 * Sabah "Kafeyi aç", gece "Kafeyi kapat". Kapanışta kasadaki nakit sayılır;
 * sistem beklenen nakitle karşılaştırıp farkı kaydeder. Sayımlar isteğe
 * bağlıdır: "Pas geç" ile girilmeden de açılıp kapanır.
 */
export function DayBar({
  cafeId,
  day,
  businessDate,
  timezone,
  openOrders,
}: {
  cafeId: string;
  day: FloorData["day"];
  businessDate: string;
  timezone: string;
  openOrders: number;
}) {
  const [sheet, setSheet] = useState<null | "open" | "close">(null);
  const stale = !!day && day.business_date < businessDate;

  // Sayfalar, gün kapanınca da (sonuç ekranı) açık kalsın diye dalların dışında
  const sheets = (
    <>
      {sheet === "open" && <OpenDaySheet cafeId={cafeId} onClose={() => setSheet(null)} />}
      {sheet === "close" && <CloseDaySheet cafeId={cafeId} timezone={timezone} openOrders={openOrders} onClose={() => setSheet(null)} />}
    </>
  );

  if (!day) {
    return (
      <>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 p-4 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-card">
            <Sunrise className="size-6" />
          </span>
          <span className="flex-1">
            <span className="block text-[17px] font-extrabold text-stone-900">Kafe kapalı</span>
            <span className="block text-[13px] text-stone-600">Satışa başlamak için günü aç. Gece kapanışta kasa sayılır.</span>
          </span>
          <Button size="lg" onClick={() => setSheet("open")}>
            <DoorOpen className="size-5" /> Kafeyi aç
          </Button>
        </div>
        {sheets}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "mt-4 flex items-center gap-3 rounded-2xl px-4 py-2.5",
          stale ? "border border-amber-300 bg-amber-50" : "border border-stone-200 bg-white shadow-card",
        )}
      >
        <span className={cn("size-2.5 shrink-0 rounded-full", stale ? "bg-amber-500" : "bg-emerald-500")} />
        <span className="min-w-0 flex-1 text-[13px] leading-tight text-stone-600">
          {stale ? (
            <b className="text-amber-900">Önceki gün kapatılmamış</b>
          ) : (
            <>
              <b className="text-stone-900">Kafe açık</b> · {formatTime(day.opened_at, timezone)}’den beri
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => setSheet("close")}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 text-[14px] font-bold text-white hover:bg-stone-800"
        >
          <DoorClosed className="size-4" /> Kafeyi kapat
        </button>
      </div>
      {sheets}
    </>
  );
}

function OpenDaySheet({ cafeId, onClose }: { cafeId: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [cash, setCash] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | "open" | "skip">(null);

  /** amount boş = sayım pas geçildi */
  const submit = async (amount: number | null) => {
    setBusy(amount === null ? "skip" : "open");
    const result = await dayOpenAction(cafeId, amount).catch(() => null);
    setBusy(null);
    if (!result) return toast.show("Bağlantı sorunu. Tekrar dene.", "error");
    if (!result.ok) return toast.show(result.error, "error");
    toast.show("Günaydın! Kafe açıldı ☕");
    onClose();
    router.refresh();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Kafeyi aç"
      description="Güne başlarken kasada bulunan nakdi gir ya da pas geç"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button size="xl" variant="secondary" className="flex-1 px-4" disabled={!!busy} onClick={() => submit(null)}>
            {busy === "skip" && <Spinner />} Pas geç
          </Button>
          <Button size="xl" className="flex-[2] px-4" disabled={!!busy || cash === null} onClick={() => submit(cash)}>
            {busy === "open" ? <Spinner /> : <DoorOpen className="size-5" />} Kafeyi aç
          </Button>
        </div>
      }
    >
      <Field label="Kasadaki açılış nakdi" hint="Bozuk para / devreden nakit. Kasa boşsa 0 yaz; saymak istemezsen pas geç.">
        <NumberInput value={cash} onValueChange={setCash} suffix={currencySymbol()} placeholder="0" inputClassName="h-14 text-[22px] font-bold" autoFocus />
      </Field>
    </Sheet>
  );
}

function CloseDaySheet({
  cafeId,
  timezone,
  openOrders,
  onClose,
}: {
  cafeId: string;
  timezone: string;
  openOrders: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<DayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [counted, setCounted] = useState<number | null>(null);
  const [pos, setPos] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "save" | "skip">(null);
  const [result, setResult] = useState<DayCloseResult | null>(null);

  useEffect(() => {
    let alive = true;
    dayStatusAction(cafeId)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setStatus(r.data);
        else toast.show(r.error, "error");
      })
      .catch(() => alive && toast.show("Bağlantı sorunu.", "error"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [cafeId, toast]);

  const open = status?.open_orders ?? openOrders;
  const live = status?.live ?? null;

  /** skip: sayım girmeden kapat. Aksi hâlde boş bırakılan alan da pas geçilmiş sayılır. */
  const submit = async (skip: boolean) => {
    setBusy(skip ? "skip" : "save");
    const r = await dayCloseAction(cafeId, skip ? null : counted, skip ? null : pos, note.trim()).catch(() => null);
    setBusy(null);
    if (!r) return toast.show("Bağlantı sorunu. Tekrar dene.", "error");
    if (!r.ok) return toast.show(r.error, "error");
    setResult(r.data);
    router.refresh();
  };

  if (result) {
    return (
      <Sheet
        open
        onClose={onClose}
        title="Kafe kapandı"
        description="İyi geceler 🌙"
        size="sm"
        footer={
          <Button size="xl" className="w-full" onClick={onClose}>
            Tamam
          </Button>
        }
      >
        <CloseResult day={result.day} difference={result.difference} cardDifference={result.card_difference} timezone={timezone} />
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Kafeyi kapat"
      description="Kasadaki nakdi ve POS kart toplamını gir ya da pas geç"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button size="xl" variant="secondary" className="flex-1 px-4" disabled={!!busy || loading || open > 0} onClick={() => submit(true)}>
            {busy === "skip" && <Spinner />} Pas geç
          </Button>
          <Button
            size="xl"
            className="flex-[2] px-4"
            disabled={!!busy || loading || open > 0 || (counted === null && pos === null)}
            onClick={() => submit(false)}
          >
            {busy === "save" ? <Spinner /> : <DoorClosed className="size-5" />} Kaydet ve kapat
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="grid h-20 place-items-center text-stone-400">
            <Spinner />
          </div>
        ) : open > 0 ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            {open} açık masa var. Kafeyi kapatmadan önce hesapları kapat ya da iptal et.
          </p>
        ) : null}

        {live && (
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={<Banknote className="size-4" />} label="Nakit satış" value={tl(live.cash)} />
            <Stat icon={<CreditCard className="size-4" />} label="Kart satış" value={tl(live.card)} />
            {live.ticket > 0 && <Stat icon={<Ticket className="size-4" />} label="Ticket" value={tl(live.ticket)} />}
            <Stat label="Ciro" value={tl(live.revenue)} />
            <Stat label="Adisyon" value={String(live.orders)} />
            <div className="col-span-2 rounded-xl bg-stone-900 px-3 py-2.5 text-white">
              <p className="text-[12px] text-stone-400">Kasada olması gereken nakit</p>
              {live.expected_cash !== null ? (
                <>
                  <p className="text-[22px] font-extrabold tabular-nums">{tl(live.expected_cash)}</p>
                  <p className="text-[11px] text-stone-400">
                    Açılış {tl(status?.open?.opening_cash ?? 0)} + nakit satış {tl(live.cash)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[17px] font-extrabold">Hesaplanamıyor</p>
                  <p className="text-[11px] text-stone-400">Açılışta kasa sayılmadı · nakit satış {tl(live.cash)}</p>
                </>
              )}
            </div>
          </div>
        )}

        <Field label="Sayılan nakit" hint="Kasadaki tüm nakdi say. Saymak istemezsen boş bırak.">
          <NumberInput value={counted} onValueChange={setCounted} suffix={currencySymbol()} placeholder="Sayılmadı" inputClassName="h-14 text-[24px] font-bold" autoFocus />
        </Field>
        {live && live.expected_cash !== null && counted !== null && (
          <DifferenceBadge difference={Math.round((counted - live.expected_cash) * 100) / 100} />
        )}

        <Field label="POS cihazındaki kart toplamı" hint="POS’tan gün sonu raporunu al; kartla geçen toplam tutarı yaz. İstersen boş bırak.">
          <NumberInput value={pos} onValueChange={setPos} suffix={currencySymbol()} placeholder="Girilmedi" inputClassName="h-14 text-[24px] font-bold" />
        </Field>
        {live && pos !== null && <DifferenceBadge kind="card" difference={Math.round((pos - live.card) * 100) / 100} />}

        <Field label="Not (isteğe bağlı)">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="örn. 100 ₺ bozuk para kasada bırakıldı"
            className="h-11 rounded-xl border border-stone-200 px-3 text-[15px] outline-none focus:border-brand-500"
          />
        </Field>
      </div>
    </Sheet>
  );
}

function CloseResult({
  day,
  difference,
  cardDifference,
  timezone,
}: {
  day: CafeDay;
  difference: number | null;
  cardDifference: number | null;
  timezone: string;
}) {
  const s = day.summary;
  return (
    <div className="flex flex-col gap-3">
      {difference !== null && <DifferenceBadge difference={difference} large />}
      {cardDifference !== null && <DifferenceBadge kind="card" difference={cardDifference} large />}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
        <dt className="text-stone-500">Açılış nakdi</dt>
        <dd className="text-right font-bold tabular-nums">{day.opening_cash != null ? tl(day.opening_cash) : "Girilmedi"}</dd>
        <dt className="text-stone-500">Sayılan nakit</dt>
        <dd className="text-right font-bold tabular-nums">{day.counted_cash != null ? tl(day.counted_cash) : "Sayılmadı"}</dd>
        {day.expected_cash != null && (
          <>
            <dt className="text-stone-500">Beklenen nakit</dt>
            <dd className="text-right font-bold tabular-nums">{tl(day.expected_cash)}</dd>
          </>
        )}
        {day.pos_total != null && (
          <>
            <dt className="text-stone-500">POS kart toplamı</dt>
            <dd className="text-right font-bold tabular-nums">{tl(day.pos_total)}</dd>
          </>
        )}
        {day.card_expected != null && (
          <>
            <dt className="text-stone-500">Sistemdeki kart</dt>
            <dd className="text-right font-bold tabular-nums">{tl(day.card_expected)}</dd>
          </>
        )}
        {s && (
          <>
            <dt className="text-stone-500">Ciro</dt>
            <dd className="text-right font-bold tabular-nums">{tl(s.revenue)}</dd>
            <dt className="text-stone-500">Kart / Nakit</dt>
            <dd className="text-right font-bold tabular-nums">
              {tl(s.card)} / {tl(s.cash)}
            </dd>
            {(s.ticket ?? 0) > 0 && (
              <>
                <dt className="text-stone-500">Ticket</dt>
                <dd className="text-right font-bold tabular-nums">{tl(s.ticket)}</dd>
              </>
            )}
            <dt className="text-stone-500">Adisyon</dt>
            <dd className="text-right font-bold tabular-nums">{s.orders}</dd>
          </>
        )}
        <dt className="text-stone-500">Açık kaldığı süre</dt>
        <dd className="text-right font-bold tabular-nums">
          {formatTime(day.opened_at, timezone)} – {day.closed_at ? formatTime(day.closed_at, timezone) : ""}
        </dd>
      </dl>
    </div>
  );
}

function DifferenceBadge({ difference, large, kind = "cash" }: { difference: number; large?: boolean; kind?: "cash" | "card" }) {
  const ok = Math.abs(difference) < 0.01;
  const label = kind === "card" ? "POS" : "Kasa";
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2.5 font-bold",
        large ? "text-[17px]" : "text-[14px]",
        ok ? "bg-emerald-50 text-emerald-800" : difference < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900",
      )}
    >
      {ok ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
      {ok ? `${label} tuttu` : difference < 0 ? `${label} ${tl(-difference)} eksik` : `${label} ${tl(difference)} fazla`}
    </p>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 px-3 py-2">
      <p className="flex items-center gap-1 text-[12px] text-stone-500">
        {icon}
        {label}
      </p>
      <p className="text-[16px] font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
