"use client";

// Panel › Web sitesi: sitenin görünümü (renkler, köşeler, sezon başlığı), ürünlerin site bilgileri
// (fotoğraf, İngilizce ad, alerjenler) ve mağaza. Ürün adı, fiyatı ve Türkçe açıklaması Menü ekranından gelir.

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ExternalLink, ImageOff, ImagePlus, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  deleteShopItemAction,
  removeShopImageAction,
  resetProductImageAction,
  saveShopItemAction,
  saveSiteProductAction,
  saveSiteSettingsAction,
} from "@/app/(panel)/[cafe]/site/actions";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input, NumberInput, TextArea, Toggle } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card, CardHeader, PageHeader, Segmented } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { tl, currencySymbol } from "@/lib/format";
import { contrast, THEME_PRESETS, type ButtonShape, type Radius, type SiteSettings, type SiteTheme } from "@/lib/site-settings";

export interface SiteProductDefaults {
  name_en: string;
  description_en: string;
  allergens: string[];
  allergen_unknown: boolean;
  featured: boolean;
  seasonal: boolean;
  image: string;
}

interface SiteProductRow {
  id: string;
  name: string;
  category: string;
  price: number;
  is_active: boolean;
  site: (Omit<SiteProductDefaults, "image"> & { image_mode: "default" | "custom" | "none"; image_ver: number; info_set: boolean }) | null;
}

interface ShopRow {
  id: string;
  name: string;
  name_en: string;
  origin: string;
  notes: string;
  notes_en: string;
  description: string;
  description_en: string;
  weight: string;
  price: number | null;
  is_active: boolean;
  sort_order: number;
  has_image: boolean;
  image_ver: number;
}

export interface SiteAdminData {
  settings: SiteSettings;
  products: SiteProductRow[];
  shop: ShopRow[];
}

type Tab = "look" | "products" | "shop";

export function SiteView({
  cafeId,
  slug,
  siteUrl,
  data,
  defaults,
  allergens,
}: {
  cafeId: string;
  slug: string;
  siteUrl: string;
  data: SiteAdminData;
  defaults: Record<string, SiteProductDefaults>;
  allergens: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>("look");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <PageHeader
        title="Web sitesi"
        description="Sitenin renkleri, ürün fotoğrafları ve mağaza. Ürün adı ve fiyatı Menü ekranından gelir."
        actions={
          <a href={siteUrl} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-[14px] font-semibold text-stone-700 hover:bg-stone-50">
            Siteyi aç <ExternalLink className="size-4" />
          </a>
        }
      />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "look", label: "Görünüm" },
          { value: "products", label: "Menü fotoğrafları" },
          { value: "shop", label: "Mağaza" },
        ]}
      />
      {tab === "look" && <LookTab cafeId={cafeId} initial={data.settings} />}
      {tab === "products" && <ProductsTab cafeId={cafeId} slug={slug} products={data.products} defaults={defaults} allergens={allergens} />}
      {tab === "shop" && <ShopTab cafeId={cafeId} slug={slug} items={data.shop} settings={data.settings} />}
      <p className="text-[13px] text-stone-500">Değişiklikler sitede en geç bir dakika içinde görünür.</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Görünüm
// ---------------------------------------------------------------------

const RADIUS_OPTIONS: { value: `${Radius}`; label: string }[] = [
  { value: "0", label: "Keskin" },
  { value: "4", label: "Hafif" },
  { value: "10", label: "Yuvarlak" },
  { value: "18", label: "Çok yuvarlak" },
];
const BUTTON_OPTIONS: { value: ButtonShape; label: string }[] = [
  { value: "square", label: "Köşeli" },
  { value: "round", label: "Yuvarlatılmış" },
  { value: "pill", label: "Hap" },
];
const COLORS: { key: "ink" | "paper" | "tint" | "mid"; label: string; hint: string }[] = [
  { key: "ink", label: "Ana renk", hint: "Yazılar, düğmeler, koyu bölümler" },
  { key: "paper", label: "Zemin", hint: "Sayfanın arka planı" },
  { key: "tint", label: "Açık zemin", hint: "Kartlar ve fotoğraf arkası" },
  { key: "mid", label: "Çizgi", hint: "Ayraçlar ve kenarlar" },
];

function LookTab({ cafeId, initial }: { cafeId: string; initial: SiteSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const theme = s.theme;
  const setTheme = (patch: Partial<SiteTheme>) => setS((v) => ({ ...v, theme: { ...v.theme, ...patch } }));
  const setSeason = (k: keyof SiteSettings["season"], val: string) => setS((v) => ({ ...v, season: { ...v.season, [k]: val } }));
  const setShop = (k: keyof SiteSettings["shop"], val: string) => setS((v) => ({ ...v, shop: { ...v.shop, [k]: val } }));
  const ratio = contrast(theme.ink, theme.paper);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    const r = await saveSiteSettingsAction(cafeId, s).catch(() => null);
    setSaving(false);
    if (!r) return toast.show("Bağlantı sorunu. Tekrar dene.", "error");
    if (!r.ok) return toast.show(r.error, "error");
    toast.show("Site ayarları kaydedildi");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <CardHeader title="Hazır temalar" description="Birini seçip aşağıdan ince ayar yapabilirsin." />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setTheme(p.theme)}
              className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3 text-left hover:border-stone-400"
            >
              <span className="flex gap-1">
                {[p.theme.ink, p.theme.paper, p.theme.tint, p.theme.mid].map((c) => (
                  <span key={c} className="size-6 rounded-full border border-stone-200" style={{ background: c }} />
                ))}
              </span>
              <span className="text-[13px] font-semibold text-stone-800">{p.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,380px)]">
        <Card className="flex flex-col gap-4 p-5">
          <CardHeader title="Renkler ve köşeler" />
          <div className="grid gap-3 sm:grid-cols-2">
            {COLORS.map((c) => (
              <Field key={c.key} label={c.label} hint={c.hint}>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme[c.key]}
                    onChange={(e) => setTheme({ [c.key]: e.target.value })}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-stone-200 bg-white p-1"
                    aria-label={c.label}
                  />
                  <Input
                    value={theme[c.key]}
                    maxLength={7}
                    onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setTheme({ [c.key]: e.target.value.toLowerCase() })}
                    className="font-mono"
                  />
                </span>
              </Field>
            ))}
          </div>
          {ratio < 4.5 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
              Ana renk ile zemin arasındaki fark düşük ({ratio.toFixed(1)}:1). Yazılar zor okunur; ana rengi koyulaştır ya da zemini açtır.
            </p>
          )}
          <Field label="Kart ve fotoğraf köşeleri">
            <Segmented value={`${theme.radius}` as `${Radius}`} onChange={(v) => setTheme({ radius: Number(v) as Radius })} options={RADIUS_OPTIONS} size="sm" className="flex-wrap" />
          </Field>
          <Field label="Düğme biçimi">
            <Segmented value={theme.button} onChange={(v) => setTheme({ button: v })} options={BUTTON_OPTIONS} size="sm" />
          </Field>
        </Card>
        <Preview theme={theme} />
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <CardHeader title="Sezon başlığı" description="Ana sayfa ve menüdeki sezonluk ürünler bölümü. Hangi ürünlerin sezonluk olduğu Menü fotoğrafları sekmesinden seçilir." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Başlık">
            <Input value={s.season.title} maxLength={40} onChange={(e) => setSeason("title", e.target.value)} />
          </Field>
          <Field label="Başlık (İngilizce)">
            <Input value={s.season.title_en} maxLength={40} onChange={(e) => setSeason("title_en", e.target.value)} />
          </Field>
          <Field label="Kısa etiket">
            <Input value={s.season.label} maxLength={40} onChange={(e) => setSeason("label", e.target.value)} />
          </Field>
          <Field label="Kısa etiket (İngilizce)">
            <Input value={s.season.label_en} maxLength={40} onChange={(e) => setSeason("label_en", e.target.value)} />
          </Field>
          <Field label="Alt metin">
            <TextArea rows={2} value={s.season.subtitle} maxLength={200} onChange={(e) => setSeason("subtitle", e.target.value)} />
          </Field>
          <Field label="Alt metin (İngilizce)">
            <TextArea rows={2} value={s.season.subtitle_en} maxLength={200} onChange={(e) => setSeason("subtitle_en", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <CardHeader title="Mağaza giriş metni" description="Mağaza sayfasının başındaki kısa açıklama." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Türkçe">
            <TextArea rows={3} value={s.shop.intro} maxLength={300} onChange={(e) => setShop("intro", e.target.value)} />
          </Field>
          <Field label="İngilizce">
            <TextArea rows={3} value={s.shop.intro_en} maxLength={300} onChange={(e) => setShop("intro_en", e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="sticky bottom-3 z-10 flex justify-end gap-2">
        {dirty && (
          <Button variant="secondary" size="lg" onClick={() => setS(initial)}>
            <RotateCcw className="size-4" /> Geri al
          </Button>
        )}
        <Button size="lg" onClick={save} disabled={saving || !dirty}>
          {saving && <Spinner />} Kaydet
        </Button>
      </div>
    </div>
  );
}

/** Sitenin küçük bir benzeri: renk ve köşe seçimlerini kaydetmeden görmek için */
function Preview({ theme }: { theme: SiteTheme }) {
  const r = theme.radius;
  const btn = theme.button === "pill" ? 999 : theme.button === "round" ? Math.max(r, 8) : 0;
  const display = "'Oswald', 'Arial Narrow', Impact, sans-serif";
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-stone-200 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-stone-500">Önizleme</div>
      <div style={{ background: theme.paper, color: theme.ink }} className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: 10 }}>
          <span style={{ fontFamily: display, fontSize: 12, letterSpacing: ".16em" }}>MENÜ</span>
          <span style={{ fontFamily: display, fontSize: 22, letterSpacing: ".04em", lineHeight: 1 }}>OPIA</span>
          <span style={{ fontFamily: display, fontSize: 12, letterSpacing: ".16em" }}>İLETİŞİM</span>
        </div>
        <p style={{ fontFamily: display, fontSize: 28, lineHeight: 1.05, textTransform: "uppercase" }}>Nitelikli kahve</p>
        <div style={{ border: `1px solid ${theme.ink}`, borderRadius: r, overflow: "hidden", background: theme.paper }} className="flex">
          <div style={{ background: theme.tint, width: 84, aspectRatio: "1", borderRight: `1px solid ${theme.ink}` }} />
          <div className="flex flex-1 flex-col justify-center gap-1 px-3">
            <span style={{ fontFamily: display, fontSize: 16, textTransform: "uppercase" }}>Flat White</span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>Çift ristretto, ipeksi süt</span>
          </div>
          <span style={{ fontFamily: display, fontSize: 16, alignSelf: "center", paddingRight: 12 }}>200 ₺</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span style={{ background: theme.ink, color: theme.paper, borderRadius: btn, fontFamily: display, fontSize: 12, letterSpacing: ".16em", padding: "12px 18px" }}>MENÜYÜ GÖR</span>
          <span style={{ border: `1px solid ${theme.ink}`, borderRadius: btn, fontFamily: display, fontSize: 12, letterSpacing: ".16em", padding: "12px 18px" }}>YOL TARİFİ</span>
        </div>
        <div style={{ borderTop: `1px solid ${theme.mid}`, paddingTop: 10, fontSize: 12, opacity: 0.7 }}>Yenibağlar, Eskişehir</div>
      </div>
      <div style={{ background: theme.ink, color: theme.paper, fontFamily: display, fontSize: 12, letterSpacing: ".16em" }} className="px-5 py-3">
        KOYU BÖLÜM
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Görsel küçültme ve yükleme
// ---------------------------------------------------------------------

/** Fotoğrafı tarayıcıda en fazla 1000 px'e küçültüp WEBP'ye (olmazsa JPEG'e) çevirir */
async function compressImage(file: File, max = 1000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  const webp = await toBlob("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg", 0.86);
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

async function uploadImage(slug: string, kind: "urun" | "magaza", id: string, file: File): Promise<string | null> {
  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch {
    return "Görsel okunamadı. JPG, PNG ya da WEBP dene.";
  }
  const body = new FormData();
  body.append("file", new File([blob], `gorsel.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }));
  body.append("tur", kind);
  body.append("id", id);
  const res = await fetch(`/${slug}/site/gorsel`, { method: "POST", body }).catch(() => null);
  if (!res) return "Bağlantı sorunu.";
  const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  return res.ok && json?.ok ? null : (json?.error ?? "Görsel yüklenemedi.");
}

function ImagePicker({ src, onPick, busy }: { src: string; onPick: (f: File) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        {busy ? <Spinner /> : src ? <img src={src} alt="" className="size-full object-cover" /> : <ImageOff className="size-6 text-stone-400" />}
      </div>
      <div className="flex flex-col gap-1">
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          <ImagePlus className="size-4" /> {src ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
        </Button>
        <span className="text-[12px] text-stone-500">Kare fotoğraf en iyi görünür. Otomatik küçültülür.</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Menü fotoğrafları ve site bilgileri
// ---------------------------------------------------------------------

function effective(p: SiteProductRow, d: SiteProductDefaults | undefined) {
  const base = d ?? { name_en: "", description_en: "", allergens: [], allergen_unknown: true, featured: false, seasonal: false, image: "" };
  const img = p.site;
  const s = img?.info_set ? img : null;
  const image = img?.image_mode === "custom" ? `/gorsel/urun/${p.id}?v=${img.image_ver}` : img?.image_mode === "none" ? "" : base.image;
  return {
    name_en: s?.name_en || base.name_en,
    description_en: s?.description_en || base.description_en,
    allergens: s ? s.allergens : base.allergens,
    allergen_unknown: s ? s.allergen_unknown : base.allergen_unknown,
    featured: s ? s.featured : base.featured,
    seasonal: s ? s.seasonal : base.seasonal,
    image,
    mode: img?.image_mode ?? "default",
    defaultImage: base.image,
  };
}

function ProductsTab({
  cafeId,
  slug,
  products,
  defaults,
  allergens,
}: {
  cafeId: string;
  slug: string;
  products: SiteProductRow[];
  defaults: Record<string, SiteProductDefaults>;
  allergens: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editing, setEditing] = useState<SiteProductRow | null>(null);
  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const out = new Map<string, SiteProductRow[]>();
    for (const p of products) {
      if (q && !p.name.toLocaleLowerCase("tr-TR").includes(q)) continue;
      if (onlyMissing && effective(p, defaults[p.id]).image) continue;
      out.set(p.category, [...(out.get(p.category) ?? []), p]);
    }
    return [...out.entries()];
  }, [products, defaults, query, onlyMissing]);
  const missing = products.filter((p) => !effective(p, defaults[p.id]).image).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ürün ara" className="pl-9" />
        </label>
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          className={cn("h-10 rounded-xl border px-3 text-[14px] font-semibold", onlyMissing ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700")}
        >
          Fotoğrafı olmayanlar ({missing})
        </button>
      </div>
      {groups.map(([cat, list]) => (
        <Card key={cat} className="p-0">
          <p className="border-b border-stone-100 px-4 py-3 text-[13px] font-bold uppercase tracking-wide text-stone-500">{cat}</p>
          <ul className="divide-y divide-stone-100">
            {list.map((p) => {
              const e = effective(p, defaults[p.id]);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setEditing(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50">
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                      {e.image ? <img src={e.image} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-4 text-stone-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-stone-900">{p.name}</span>
                      <span className="block truncate text-[13px] text-stone-500">
                        {e.name_en || "İngilizce ad yok"} · {e.allergen_unknown && !e.allergens.length ? "alerjen bilinmiyor" : e.allergens.length ? `${e.allergens.length} alerjen` : "alerjen yok"}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {e.featured && <Badge tone="brand">Öne çıkan</Badge>}
                      {e.seasonal && <Badge tone="amber">Sezonluk</Badge>}
                      {!p.is_active && <Badge tone="neutral">Satışta değil</Badge>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      {editing && (
        <ProductEditor cafeId={cafeId} slug={slug} product={editing} defaults={defaults[editing.id]} allergens={allergens} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ProductEditor({
  cafeId,
  slug,
  product,
  defaults,
  allergens,
  onClose,
}: {
  cafeId: string;
  slug: string;
  product: SiteProductRow;
  defaults: SiteProductDefaults | undefined;
  allergens: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const e = effective(product, defaults);
  const [nameEn, setNameEn] = useState(e.name_en);
  const [descEn, setDescEn] = useState(e.description_en);
  const [list, setList] = useState<string[]>(e.allergens);
  const [unknown, setUnknown] = useState(e.allergen_unknown);
  const [featured, setFeatured] = useState(e.featured);
  const [seasonal, setSeasonal] = useState(e.seasonal);
  const [image, setImage] = useState(e.image);
  const [mode, setMode] = useState(e.mode);
  const [busyImg, setBusyImg] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = async (file: File) => {
    setBusyImg(true);
    const err = await uploadImage(slug, "urun", product.id, file);
    setBusyImg(false);
    if (err) return toast.show(err, "error");
    setImage(URL.createObjectURL(file));
    setMode("custom");
    toast.show("Fotoğraf yüklendi");
    router.refresh();
  };
  const reset = async (to: "default" | "none") => {
    setBusyImg(true);
    const r = await resetProductImageAction(cafeId, product.id, to).catch(() => null);
    setBusyImg(false);
    if (!r?.ok) return toast.show(r?.ok === false ? r.error : "Bağlantı sorunu.", "error");
    setImage(to === "default" ? e.defaultImage : "");
    setMode(to);
  };
  const save = async () => {
    setSaving(true);
    const r = await saveSiteProductAction(cafeId, product.id, {
      name_en: nameEn,
      description_en: descEn,
      allergens: list,
      allergen_unknown: unknown && list.length === 0,
      featured,
      seasonal,
    }).catch(() => null);
    setSaving(false);
    if (!r) return toast.show("Bağlantı sorunu. Tekrar dene.", "error");
    if (!r.ok) return toast.show(r.error, "error");
    toast.show("Kaydedildi");
    onClose();
  };
  const toggle = (id: string) => {
    setList((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    setUnknown(false);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      description={`${product.category} · ${tl(product.price)} · ad, fiyat ve Türkçe açıklama Menü ekranından`}
      size="md"
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving && <Spinner />} Kaydet
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Fotoğraf">
          <ImagePicker src={image} onPick={pick} busy={busyImg} />
          <div className="flex flex-wrap gap-2">
            {mode !== "default" && e.defaultImage && (
              <Button variant="ghost" size="sm" onClick={() => reset("default")} disabled={busyImg}>
                <RotateCcw className="size-4" /> İlk fotoğrafa dön
              </Button>
            )}
            {image && (
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => reset("none")} disabled={busyImg}>
                <Trash2 className="size-4" /> Fotoğrafı kaldır
              </Button>
            )}
          </div>
        </Field>
        <Field label="İngilizce ad" hint="Boşsa İngilizce sayfada Türkçe ad görünür.">
          <Input value={nameEn} maxLength={60} onChange={(ev) => setNameEn(ev.target.value)} />
        </Field>
        <Field label="İngilizce açıklama">
          <TextArea rows={2} value={descEn} maxLength={300} onChange={(ev) => setDescEn(ev.target.value)} />
        </Field>
        <Field label="Alerjenler" hint="Sitede ürün penceresinde ve alerjen filtresinde kullanılır.">
          <div className="flex flex-wrap gap-2">
            {allergens.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className={cn(
                  "h-9 rounded-full border px-3 text-[13px] font-semibold",
                  list.includes(a.id) ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-700",
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
        </Field>
        {list.length === 0 && (
          <Toggle
            checked={unknown}
            onChange={setUnknown}
            label="Alerjen bilgisi bilinmiyor"
            description={unknown ? "Sitede “Alerjen bilgisi için personelimize sorun” yazar." : "Sitede “Bilinen alerjen içermez” yazar."}
          />
        )}
        <Toggle checked={featured} onChange={setFeatured} label="Öne çıkan" description="Ana sayfadaki “Sevilenler” bölümünde görünür (ilk 3)." />
        <Toggle checked={seasonal} onChange={setSeasonal} label="Sezonluk" description="Sezon başlığının altında, menünün en üstünde görünür." />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Mağaza
// ---------------------------------------------------------------------

const EMPTY_ITEM: ShopRow = {
  id: "",
  name: "",
  name_en: "",
  origin: "",
  notes: "",
  notes_en: "",
  description: "",
  description_en: "",
  weight: "250 g",
  price: null,
  is_active: true,
  sort_order: 0,
  has_image: false,
  image_ver: 0,
};

function ShopTab({ cafeId, slug, items, settings }: { cafeId: string; slug: string; items: ShopRow[]; settings: SiteSettings }) {
  const [editing, setEditing] = useState<ShopRow | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">Satış kapalı</Badge>
          <span className="text-[14px] text-stone-600">Sitede her üründe “Yakında satışta” yazar; ödeme altyapısı (iyzico) bağlanınca açılacak.</span>
        </div>
        <p className="text-[13px] text-stone-500">Giriş metni: “{settings.shop.intro}” (Görünüm sekmesinden değiştirilir)</p>
      </Card>
      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <p className="text-[15px] font-bold text-stone-900">Ürünler</p>
          <Button size="sm" onClick={() => setEditing({ ...EMPTY_ITEM, sort_order: (items.at(-1)?.sort_order ?? 0) + 1 })}>
            <Plus className="size-4" /> Ürün ekle
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-[14px] text-stone-500">
            Henüz ürün eklenmedi. Sitede şimdilik Brew Bar çekirdeklerinden oluşan varsayılan liste görünüyor; ilk ürünü eklediğinde senin listen geçerli olur.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50">
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                    {i.has_image ? <img src={`/gorsel/magaza/${i.id}?v=${i.image_ver}`} alt="" className="size-full object-cover" /> : <ImageOff className="size-4 text-stone-400" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-stone-900">{i.name}</span>
                    <span className="block truncate text-[13px] text-stone-500">{[i.origin, i.weight, i.price !== null ? tl(i.price) : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                  {!i.is_active && <Badge tone="neutral">Gizli</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && <ShopEditor cafeId={cafeId} slug={slug} item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ShopEditor({ cafeId, slug, item, onClose }: { cafeId: string; slug: string; item: ShopRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(item);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(item.has_image ? `/gorsel/magaza/${item.id}?v=${item.image_ver}` : "");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof ShopRow>(k: K, val: ShopRow[K]) => setV((x) => ({ ...x, [k]: val }));

  const save = async () => {
    if (!v.name.trim()) return toast.show("Ürün adını yaz.", "error");
    setSaving(true);
    const r = await saveShopItemAction(cafeId, {
      id: v.id || null,
      name: v.name,
      name_en: v.name_en,
      origin: v.origin,
      notes: v.notes,
      notes_en: v.notes_en,
      description: v.description,
      description_en: v.description_en,
      weight: v.weight,
      price: v.price,
      is_active: v.is_active,
      sort_order: v.sort_order,
    }).catch(() => null);
    if (!r || !r.ok) {
      setSaving(false);
      return toast.show(r ? r.error : "Bağlantı sorunu.", "error");
    }
    if (file) {
      const err = await uploadImage(slug, "magaza", r.data.id, file);
      if (err) toast.show(`Ürün kaydedildi; ${err}`, "error");
    } else if (!preview && item.has_image) {
      await removeShopImageAction(cafeId, r.data.id).catch(() => null);
    }
    setSaving(false);
    toast.show(item.id ? "Ürün güncellendi" : "Ürün eklendi");
    router.refresh();
    onClose();
  };
  const remove = async () => {
    setSaving(true);
    const r = await deleteShopItemAction(cafeId, item.id).catch(() => null);
    setSaving(false);
    setConfirm(false);
    if (!r?.ok) return toast.show(r?.ok === false ? r.error : "Bağlantı sorunu.", "error");
    toast.show("Ürün silindi");
    router.refresh();
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={item.id ? "Mağaza ürünü" : "Yeni mağaza ürünü"}
        size="md"
        footer={
          <div className="flex gap-2">
            {item.id && (
              <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirm(true)} aria-label="Ürünü sil">
                <Trash2 className="size-5" />
              </Button>
            )}
            <Button size="lg" className="flex-1" onClick={save} disabled={saving}>
              {saving && <Spinner />} Kaydet
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Fotoğraf">
            <ImagePicker
              src={preview}
              busy={false}
              onPick={(f) => {
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }}
            />
            {preview && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start text-red-600"
                onClick={() => {
                  setFile(null);
                  setPreview("");
                }}
              >
                <Trash2 className="size-4" /> Fotoğrafı kaldır
              </Button>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ad">
              <Input value={v.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="örn. Kenya Kathakwa" autoFocus={!item.id} />
            </Field>
            <Field label="Ad (İngilizce)">
              <Input value={v.name_en} maxLength={80} onChange={(e) => set("name_en", e.target.value)} />
            </Field>
            <Field label="Köken / işlem" className="sm:col-span-2">
              <Input value={v.origin} maxLength={80} onChange={(e) => set("origin", e.target.value)} placeholder="örn. Kenya, Kirinyaga · Yıkanmış" />
            </Field>
            <Field label="Tadım notları">
              <Input value={v.notes} maxLength={160} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Field label="Tadım notları (İngilizce)">
              <Input value={v.notes_en} maxLength={160} onChange={(e) => set("notes_en", e.target.value)} />
            </Field>
            <Field label="Açıklama">
              <TextArea rows={3} value={v.description} maxLength={600} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Açıklama (İngilizce)">
              <TextArea rows={3} value={v.description_en} maxLength={600} onChange={(e) => set("description_en", e.target.value)} />
            </Field>
            <Field label="Paket">
              <Input value={v.weight} maxLength={20} onChange={(e) => set("weight", e.target.value)} placeholder="250 g" />
            </Field>
            <Field label="Fiyat" hint="Boş bırakılırsa fiyat gösterilmez.">
              <NumberInput value={v.price} onValueChange={(n) => set("price", n)} suffix={currencySymbol()} placeholder="Yok" />
            </Field>
            <Field label="Sıra" hint="Küçük olan önce görünür.">
              <NumberInput value={v.sort_order} onValueChange={(n) => set("sort_order", Math.max(0, Math.round(n ?? 0)))} />
            </Field>
          </div>
          <Toggle checked={v.is_active} onChange={(b) => set("is_active", b)} label="Sitede göster" />
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title="Ürün silinsin mi?"
        description={`“${item.name}” mağazadan kaldırılır.`}
        confirmLabel="Sil"
        danger
        pending={saving}
      />
    </>
  );
}
