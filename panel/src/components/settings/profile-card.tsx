"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Store, Trash2 } from "lucide-react";
import { setLogoAction, updateCafeSettingsAction } from "@/app/(panel)/[cafe]/ayarlar/actions";
import { LogoMark } from "@/components/brand/logo";
import { THEMES } from "@/components/brand/themes";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Card, CardHeader } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { CafeContext, CafeTheme } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { CURRENCIES } from "@/lib/format";

const LOGO_SIZE = 256;
const LOGO_MAX_BYTES = 190_000;

/** Seçilen resmi kare tuvale sığdırıp küçültür (WebP; desteklenmezse PNG/JPEG) */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Resim okunamadı"));
      el.src = url;
    });
    const scale = Math.min(1, LOGO_SIZE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    for (const [type, quality] of [["image/webp", 0.9], ["image/png", 1], ["image/jpeg", 0.85]] as const) {
      const data = canvas.toDataURL(type, quality);
      if (data.startsWith(`data:${type}`) && data.length <= LOGO_MAX_BYTES) return data;
    }
    throw new Error("Logo çok büyük; daha sade bir resim seç");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Kafe profili: ad, logo, renk paleti, para birimi, dil (yalnızca sahip) */
export function ProfileCard({ ctx }: { ctx: CafeContext }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(ctx.cafe.name);
  const [theme, setTheme] = useState<CafeTheme>(ctx.cafe.theme);
  const [currency, setCurrency] = useState(ctx.cafe.currency);
  const [language, setLanguage] = useState(ctx.cafe.language);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const dirty = name.trim() !== ctx.cafe.name || theme !== ctx.cafe.theme || currency !== ctx.cafe.currency || language !== ctx.cafe.language;

  const save = async () => {
    if (!name.trim()) return toast.show("Kafe adını gir", "error");
    setSaving(true);
    const result = await updateCafeSettingsAction(ctx.cafe.id, { name: name.trim(), theme, currency, language }).catch(() => null);
    setSaving(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Profil kaydedildi");
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const data = await shrinkImage(file);
      const result = await setLogoAction(ctx.cafe.id, data).catch(() => null);
      if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
      toast.show("Logo yüklendi");
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Logo yüklenemedi", "error");
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    const result = await setLogoAction(ctx.cafe.id, null).catch(() => null);
    setLogoBusy(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Logo kaldırıldı");
  };

  return (
    <Card className="mt-5">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Store className="size-5 text-brand-600" /> Kafe profili
          </span>
        }
        description="Adın, logon ve rengin giriş ekranında, menüde ve raporlarda görünür."
      />
      <div className="grid gap-5 px-4 pb-5 pt-4 sm:grid-cols-[auto_1fr] sm:px-5">
        {/* Logo */}
        <div className="flex items-center gap-4 sm:flex-col sm:items-center">
          <LogoMark size={88} logo={ctx.cafe.logo} name={ctx.cafe.name} />
          <div className="flex flex-wrap gap-2 sm:justify-center">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => uploadLogo(e.target.files?.[0])}
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={logoBusy}>
              {logoBusy ? <Spinner /> : <ImagePlus className="size-4" />} {ctx.cafe.logo ? "Değiştir" : "Logo yükle"}
            </Button>
            {ctx.cafe.logo && (
              <Button variant="ghost" size="sm" className="text-red-700" onClick={removeLogo} disabled={logoBusy} aria-label="Logoyu kaldır">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kafe adı" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>

          <Field label="Renk" className="sm:col-span-2">
            <div role="radiogroup" aria-label="Renk paleti" className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.key}
                  onClick={() => setTheme(t.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
                    theme === t.key ? "border-stone-900 bg-stone-50 text-stone-900" : "border-stone-200 text-stone-600 hover:border-stone-300",
                  )}
                >
                  <span className="grid size-5 place-items-center rounded-full" style={{ background: t.swatch }}>
                    {theme === t.key && <Check className="size-3.5 text-white" strokeWidth={3} />}
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Para birimi" hint="Fiyatlar ve raporlar bu birimle gösterilir; tutarlar dönüştürülmez.">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Dil" hint="Sayı ve para biçimi de dile göre değişir.">
            <Select value={language} onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "tr")}>
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving && <Spinner />} Kaydet
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
