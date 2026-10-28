"use client";

import { useMemo, useState } from "react";
import { Check, Gift, Lock, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import type { MenuProduct, OrderItem } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { tl, currencySymbol } from "@/lib/format";
import { defaultOptionIds, linePrice, sortIds, type MenuIndex } from "@/lib/pos/optimistic";
import { usePerms } from "@/components/shell/perms";

type Submit = {
  optionIds: string[];
  quantity: number;
  note: string;
  isComp: boolean;
  /** Yalnızca düzenlemede: satırın birim fiyatı ve birim indirimi */
  unitPrice: number;
  unitDiscount: number;
};

type Discount = { kind: "pct"; value: number } | { kind: "amount"; value: number | null };

const DISCOUNT_RATES = [0.1, 0.2, 0.25, 0.5];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function OptionSheet(
  props:
    | {
        mode: "add";
        product: MenuProduct;
        index: MenuIndex;
        onClose: () => void;
        onSubmit: (value: Submit) => void;
      }
    | {
        mode: "edit";
        item: OrderItem;
        product: MenuProduct | undefined;
        index: MenuIndex;
        onClose: () => void;
        onSubmit: (value: Submit) => void;
        onRemove: () => void;
      },
) {
  const { index, product, onClose, onSubmit } = props;
  const item = props.mode === "edit" ? props.item : null;
  // Ödenmiş pay varsa satır kilitli; adet, ödenmiş payların karşılığının altına inemez
  const paidQty = item ? Math.ceil((item.paid_parts ?? item.paid_quantity ?? 0) / (item.split_parts ?? 1)) : 0;
  const locked = paidQty > 0;
  const isJoker = !!product?.is_open_price;
  const perms = usePerms();

  const [selected, setSelected] = useState<string[]>(() =>
    item ? sortIds(item.option_ids) : product ? defaultOptionIds(index, product) : [],
  );
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [note, setNote] = useState(item?.note ?? "");
  const [isComp, setIsComp] = useState(item?.is_comp ?? false);
  // Menü fiyatından farklı elle girilen fiyat (null = menü fiyatı)
  const [customPrice, setCustomPrice] = useState<number | null>(() =>
    item && (isJoker || item.unit_price !== item.list_price) ? item.unit_price : null,
  );
  const [discount, setDiscount] = useState<Discount>(() => ({ kind: "amount", value: item?.unit_discount || null }));

  const groups = useMemo(
    () =>
      product && !isJoker
        ? product.group_ids.map((g) => index.groups.get(g)).filter((g): g is NonNullable<typeof g> => !!g && g.options.length > 0)
        : [],
    [product, index, isJoker],
  );

  const missingRequired = groups.filter((g) => g.is_required && !g.options.some((o) => selected.includes(o.id)));
  const menuPrice = product && !isJoker ? linePrice(index, product.id, selected, item?.list_price ?? 0) : (item?.list_price ?? 0);
  const unitPrice = customPrice ?? menuPrice;
  const unitDiscount = Math.min(
    unitPrice,
    discount.kind === "pct" ? round2(unitPrice * discount.value) : Math.max(0, discount.value ?? 0),
  );
  const netUnit = round2(unitPrice - unitDiscount);
  const priceInvalid = customPrice !== null && (customPrice <= 0 || customPrice >= 100000);

  const toggle = (groupId: string, optionId: string) => {
    if (locked) return;
    const group = index.groups.get(groupId);
    if (!group) return;
    setSelected((prev) => {
      if (group.selection === "multi") {
        return sortIds(prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]);
      }
      const others = prev.filter((id) => !group.options.some((o) => o.id === id));
      // Zorunlu olmayan tek seçimli grupta seçili olana tekrar dokunmak seçimi kaldırır
      if (prev.includes(optionId) && !group.is_required && !group.options.find((o) => o.id === optionId)?.is_default) {
        const fallback = group.options.find((o) => o.is_default);
        return sortIds(fallback ? [...others, fallback.id] : others);
      }
      return sortIds([...others, optionId]);
    });
  };

  const title = item ? item.name : product?.name;
  const submit = () =>
    onSubmit({ optionIds: selected, quantity, note: note.trim(), isComp, unitPrice: round2(unitPrice), unitDiscount: round2(unitDiscount) });

  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      description={product?.description || (item ? "Satırı düzenle" : undefined)}
      size="md"
      footer={
        <div className="flex gap-2">
          {props.mode === "edit" && !locked && (
            <Button variant="secondary" size="xl" className="px-4 text-red-600" onClick={props.onRemove} aria-label="Satırı sil">
              <Trash2 className="size-5" />
            </Button>
          )}
          <Button size="xl" className="flex-1" disabled={missingRequired.length > 0 || priceInvalid || quantity < paidQty} onClick={submit}>
            {missingRequired.length > 0 ? `${missingRequired[0].name} seç` : props.mode === "add" ? "Ekle" : "Kaydet"}
            <span className="tabular-nums opacity-90">· {isComp ? "İkram" : tl(netUnit * quantity)}</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {!product && item && (
          <p className="rounded-xl bg-stone-50 px-3 py-2 text-[13px] text-stone-500">Bu ürün menüden kaldırılmış; yalnızca adet, not, fiyat ve ikram değiştirilebilir.</p>
        )}
        {locked && (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
            <Lock className="mt-0.5 size-4 shrink-0" />
            Bu satırın ödemesi alınmaya başlandı. Seçenek, fiyat ve ikram değiştirilemez; adet en az {paidQty} olmalı.
          </p>
        )}

        {groups.map((group) => (
          <fieldset key={group.id} disabled={locked}>
            <legend className="mb-2 flex items-center gap-2 text-[14px] font-bold text-stone-800">
              {group.name}
              {group.is_required && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">Zorunlu</span>}
              {group.selection === "multi" && <span className="text-[12px] font-medium text-stone-400">birden fazla seçilebilir</span>}
            </legend>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const active = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(group.id, option.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex h-12 items-center gap-2 rounded-xl border-2 px-4 text-[15px] font-semibold transition active:scale-[0.97] disabled:opacity-60",
                      active ? "border-brand-500 bg-brand-50 text-brand-900" : "border-stone-200 bg-white text-stone-700 hover:border-stone-300",
                    )}
                  >
                    {active && <Check className="size-4 text-brand-600" />}
                    {option.name}
                    {option.price_delta !== 0 && (
                      <span className={cn("text-[13px] font-bold tabular-nums", active ? "text-brand-700" : "text-stone-400")}>
                        {option.price_delta > 0 ? "+" : "−"}
                        {tl(Math.abs(option.price_delta))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] font-bold text-stone-800">Adet</span>
          <div className="flex items-center rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(Math.max(1, paidQty), q - 1))}
              className="grid size-12 place-items-center text-stone-600"
              aria-label="Azalt"
            >
              <Minus className="size-5" />
            </button>
            <span className="w-10 text-center text-[18px] font-bold tabular-nums">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} className="grid size-12 place-items-center text-brand-700" aria-label="Artır">
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold text-stone-800">Not</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 120))}
            placeholder="örn. az buzlu, sıcak servis"
            className="h-11 rounded-xl border border-stone-200 px-3 text-[15px] outline-none focus:border-brand-500"
          />
        </label>

        {props.mode === "edit" && !locked && !isComp && perms.discounts && (
          <fieldset className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-3">
            <legend className="px-1 text-[14px] font-bold text-stone-800">Fiyat ve indirim</legend>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[12px] font-semibold text-stone-500">Birim fiyat {isJoker ? "" : `· menü ${tl(menuPrice)}`}</span>
                <NumberInput
                  value={customPrice ?? menuPrice}
                  onValueChange={(v) => setCustomPrice(v === null ? 0 : v === menuPrice && !isJoker ? null : v)}
                  suffix={currencySymbol()}
                  inputClassName="h-12 text-[18px] font-bold"
                />
              </label>
              {customPrice !== null && !isJoker && (
                <button
                  type="button"
                  onClick={() => setCustomPrice(null)}
                  className="flex h-12 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-[13px] font-semibold text-stone-600"
                >
                  <RotateCcw className="size-4" /> Menü fiyatı
                </button>
              )}
            </div>
            {priceInvalid && <p className="text-[13px] font-medium text-red-600">Fiyat 0’dan büyük olmalı.</p>}

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-stone-500">Bu ürüne indirim</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={unitDiscount === 0} onClick={() => setDiscount({ kind: "amount", value: null })}>
                  Yok
                </Chip>
                {DISCOUNT_RATES.map((r) => (
                  <Chip key={r} active={discount.kind === "pct" && discount.value === r} onClick={() => setDiscount({ kind: "pct", value: r })}>
                    %{r * 100}
                  </Chip>
                ))}
              </div>
              <NumberInput
                value={discount.kind === "amount" ? discount.value : unitDiscount || null}
                onValueChange={(v) => setDiscount({ kind: "amount", value: v })}
                suffix={currencySymbol()}
                placeholder="Birim başı indirim tutarı"
              />
            </div>
            {(unitDiscount > 0 || customPrice !== null) && (
              <p className="text-[13px] text-stone-600">
                Adet başı <b className="tabular-nums">{tl(netUnit)}</b>
                {unitDiscount > 0 && <> · {tl(unitDiscount)} indirim</>}
                {customPrice !== null && !isJoker && customPrice > menuPrice && <> · menü fiyatının {tl(customPrice - menuPrice)} üstünde</>}
              </p>
            )}
          </fieldset>
        )}

        {props.mode === "edit" && !locked && (perms.discounts || isComp) && (
          <button
            type="button"
            onClick={() => setIsComp((v) => !v)}
            aria-pressed={isComp}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition",
              isComp ? "border-emerald-500 bg-emerald-50" : "border-stone-200",
            )}
          >
            <Gift className={cn("size-5", isComp ? "text-emerald-600" : "text-stone-400")} />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">İkram</span>
              <span className="block text-[12px] text-stone-500">Hesaba yansımaz, maliyeti raporda görünür</span>
            </span>
            <span className={cn("grid size-6 place-items-center rounded-md border-2", isComp ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300")}>
              {isComp && <Check className="size-4" />}
            </span>
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Joker: menüde olmayan bir şey satıldığında fiyatı elle girilir, maliyeti 0 sayılır */
export function JokerSheet({
  product,
  onClose,
  onSubmit,
}: {
  product: MenuProduct;
  onClose: () => void;
  onSubmit: (value: { price: number; note: string; quantity: number }) => void;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const valid = price !== null && price > 0 && price < 100000;

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      description="Menüde olmayan ürün · istediğin fiyatı gir, maliyeti 0 sayılır"
      size="sm"
      footer={
        <Button size="xl" className="w-full" disabled={!valid} onClick={() => valid && onSubmit({ price: round2(price), note: note.trim(), quantity })}>
          Ekle <span className="tabular-nums opacity-90">· {tl((price ?? 0) * quantity)}</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold text-stone-800">Fiyat</span>
          <NumberInput value={price} onValueChange={setPrice} suffix={currencySymbol()} placeholder="0" inputClassName="h-14 text-[24px] font-bold" autoFocus />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold text-stone-800">Ne satıldı?</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 120))}
            placeholder="örn. şişe su, özel sipariş pasta"
            className="h-11 rounded-xl border border-stone-200 px-3 text-[15px] outline-none focus:border-brand-500"
          />
        </label>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] font-bold text-stone-800">Adet</span>
          <div className="flex items-center rounded-xl border border-stone-200">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="grid size-12 place-items-center text-stone-600" aria-label="Azalt">
              <Minus className="size-5" />
            </button>
            <span className="w-10 text-center text-[18px] font-bold tabular-nums">{quantity}</span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} className="grid size-12 place-items-center text-brand-700" aria-label="Artır">
              <Plus className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 rounded-full border px-4 text-[14px] font-semibold transition",
        active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-700 hover:border-stone-300",
      )}
    >
      {children}
    </button>
  );
}
