"use client";

import { useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { addMemberAction } from "@/app/(panel)/[cafe]/ayarlar/actions";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { Role } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  FIGURES_CHOICES,
  ROLE_DEFAULTS,
  YES_NO_QUESTIONS,
  customPart,
  figuresLabel,
  type Permissions,
} from "@/lib/permissions";

export const ROLE_CHOICES: { value: Role; label: string; description: string }[] = [
  { value: "staff", label: "Barista", description: "Sipariş alır, ödeme alır" },
  { value: "manager", label: "Müdür", description: "Satışın yanında menü ve raporlarla da ilgilenir" },
  { value: "owner", label: "Ortak / sahip", description: "Her şey: finans, ekip ve ayarlar dahil" },
];

export function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  return Array.from({ length: 4 }, () => pick(letters)).join("") + Array.from({ length: 4 }, () => pick(digits)).join("");
}

/** Yetki soruları: ciro kapsamı + evet/hayır soruları (sahip için gösterilmez) */
export function PermissionQuestions({ value, onChange }: { value: Permissions; onChange: (next: Permissions) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[14px] font-bold text-stone-900">Ciroyu ne kadar görsün?</legend>
        <div className="grid grid-cols-2 gap-2">
          {FIGURES_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={value.figures === c.value}
              onClick={() => onChange({ ...value, figures: c.value })}
              className={cn(
                "rounded-xl border-2 px-3 py-2 text-left transition",
                value.figures === c.value ? "border-brand-500 bg-brand-50" : "border-stone-200 hover:border-stone-300",
              )}
            >
              <span className="block text-[14px] font-semibold">{c.label}</span>
              <span className="block text-[11.5px] leading-snug text-stone-500">{c.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <ul className="flex flex-col divide-y divide-stone-100 rounded-2xl border border-stone-200">
        {YES_NO_QUESTIONS.map((q) => (
          <li key={q.key} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-stone-900">{q.question}</span>
              <span className="block text-[12px] text-stone-500">{q.hint}</span>
            </span>
            <span className="flex shrink-0 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label={q.question}>
              {[true, false].map((answer) => (
                <button
                  key={String(answer)}
                  type="button"
                  role="radio"
                  aria-checked={value[q.key] === answer}
                  onClick={() => onChange({ ...value, [q.key]: answer })}
                  className={cn(
                    "h-8 rounded-lg px-3 text-[13px] font-semibold transition",
                    value[q.key] === answer ? (answer ? "bg-brand-600 text-white shadow-card" : "bg-white text-stone-900 shadow-card") : "text-stone-500",
                  )}
                >
                  {answer ? "Evet" : "Hayır"}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Yetkilerin kısa özeti (ekip listesi ve sihirbazın son adımı) */
export function PermissionSummary({ value, className }: { value: Permissions; className?: string }) {
  const items: { label: string; on: boolean }[] = [
    { label: `Ciro: ${figuresLabel(value.figures).toLocaleLowerCase("tr")}`, on: value.figures !== "none" },
    { label: "Kâr", on: value.profit },
    { label: "Raporlar", on: value.reports },
    { label: "Silme/iptal", on: value.void },
    { label: "Ödeme değiştirme", on: value.payments },
    { label: "İndirim/ikram", on: value.discounts },
    { label: "Menü", on: value.menu },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((i) => (
        <li
          key={i.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
            i.on ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-400 line-through",
          )}
        >
          {i.on ? <Check className="size-3" /> : <X className="size-3" />}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const STEPS = ["Kim?", "Görevi", "Yetkiler", "Özet"] as const;

/** Ekibe kişi ekleme sihirbazı: sahibe birkaç soru sorup yetkileri buna göre verir */
export function AddMemberWizard({ cafeId, onClose }: { cafeId: string; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<Role>("staff");
  const [perms, setPerms] = useState<Permissions>(ROLE_DEFAULTS.staff);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "owner";
  const validPerson = /^\S+@\S+\.\S+$/.test(email.trim()) && (password === "" || (password.length >= 6 && /\d/.test(password) && /\D/.test(password)));

  const chooseRole = (r: Role) => {
    setRole(r);
    setPerms(ROLE_DEFAULTS[r]);
  };

  const next = () => {
    setError(null);
    // Sahip için yetki sorusu yok: doğrudan özete
    setStep((s) => (s === 1 && isOwner ? 3 : Math.min(3, s + 1)));
  };
  const back = () => setStep((s) => (s === 3 && isOwner ? 1 : Math.max(0, s - 1)));

  const save = async () => {
    setError(null);
    setSaving(true);
    const result = await addMemberAction(cafeId, {
      email,
      displayName,
      role,
      password,
      permissions: isOwner ? {} : customPart(role, perms),
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.error);
    toast.show(`${displayName || email} ekibe eklendi`);
    onClose();
  };

  const name = displayName.trim() || "Bu kişi";

  return (
    <Sheet
      open
      onClose={onClose}
      title="Ekibe kişi ekle"
      description={`${step + 1}/4 · ${STEPS[step]}`}
      size="md"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" size="lg" onClick={back} disabled={saving}>
                <ArrowLeft className="size-5" /> Geri
              </Button>
            )}
            {step < 3 ? (
              <Button size="lg" className="flex-1" onClick={next} disabled={step === 0 && !validPerson}>
                Devam
              </Button>
            ) : (
              <Button size="lg" className="flex-1" onClick={save} disabled={saving}>
                {saving && <Spinner />} Ekibe ekle
              </Button>
            )}
          </div>
        </div>
      }
    >
      <ol className="mb-4 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <li key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-500" : "bg-stone-200")} />
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Adı">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} placeholder="örn. Ayşe" autoFocus />
            </Field>
            <Field label="E-posta" hint="Giriş için kullanılır">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="ayse@ornek.com" />
            </Field>
          </div>
          <Field label="İlk şifresi" hint="En az 6 karakter, harf ve rakam. Kişiye ilet; sonra Ayarlar › Ekip’ten değiştirilebilir. Hesabı zaten varsa boş bırak.">
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="font-mono" />
              <Button variant="secondary" onClick={() => setPassword(generatePassword())}>
                Yeni
              </Button>
            </div>
          </Field>
        </div>
      )}

      {step === 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-bold text-stone-900">{name} kafede ne iş yapacak?</legend>
          {ROLE_CHOICES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={role === r.value}
              onClick={() => chooseRole(r.value)}
              className={cn("rounded-xl border-2 px-3 py-3 text-left", role === r.value ? "border-brand-500 bg-brand-50" : "border-stone-200")}
            >
              <span className="block text-[15px] font-semibold">{r.label}</span>
              <span className="block text-[12.5px] text-stone-500">{r.description}</span>
            </button>
          ))}
          <p className="mt-1 text-[12.5px] text-stone-500">Sonraki adımda neleri görebileceğini ve yapabileceğini tek tek seçeceksin.</p>
        </fieldset>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-stone-600">
            {name} için birkaç soru. Cevaplar önerilen ayarlarla dolu geldi; istediğini değiştir.
          </p>
          <PermissionQuestions value={perms} onChange={setPerms} />
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3 text-[14px]">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl bg-stone-50 p-4">
            <dt className="text-stone-500">Ad</dt>
            <dd className="font-semibold">{displayName || "—"}</dd>
            <dt className="text-stone-500">E-posta</dt>
            <dd className="font-semibold break-all">{email}</dd>
            <dt className="text-stone-500">Şifre</dt>
            <dd className="font-mono font-semibold">{password || "(mevcut hesap)"}</dd>
            <dt className="text-stone-500">Görevi</dt>
            <dd className="font-semibold">{ROLE_CHOICES.find((r) => r.value === role)?.label}</dd>
          </dl>
          {isOwner ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Sahip her şeyi görür ve yapar: finans, ekip ve ayarlar dahil.</p>
          ) : (
            <PermissionSummary value={perms} />
          )}
        </div>
      )}
    </Sheet>
  );
}
