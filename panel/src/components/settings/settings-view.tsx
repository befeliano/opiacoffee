"use client";

import { useState } from "react";
import { Clock, FlaskConical, KeyRound, Pencil, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { purgeDemoDataAction, refreshDemoDataAction, removeMemberAction, resetPasswordAction, updateCafeSettingsAction, updateMemberAction } from "@/app/(panel)/[cafe]/ayarlar/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select, Toggle } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { CafeContext, Role, TeamMember } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { effectivePermissions, ROLE_DEFAULTS, customPart, type Permissions } from "@/lib/permissions";
import { AddMemberWizard, generatePassword, PermissionQuestions, PermissionSummary, ROLE_CHOICES } from "./member-wizard";
import { ProfileCard } from "./profile-card";

const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  owner: { label: "Sahip", description: "Her şey: finans, ekip ve kafe ayarları dahil" },
  manager: { label: "Müdür", description: "Varsayılan: satış, menü ve maliyet, masa düzeni, rapor ve analiz" },
  staff: { label: "Barista", description: "Varsayılan: satış ekranı, bugünün ve dünün adisyonları" },
};

const HOURS = Array.from({ length: 25 }, (_, h) => h);

const TIMEZONES = [
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Paris",
  "Europe/Athens",
  "Asia/Baku",
  "Asia/Dubai",
  "Asia/Nicosia",
  "America/New_York",
];

export interface DemoStatus {
  orders: number;
  expenses: number;
  real_orders: number;
}

export function SettingsView({
  ctx,
  team,
  localMode,
  demo,
}: {
  ctx: CafeContext;
  team: TeamMember[];
  localMode: boolean;
  demo: DemoStatus | null;
}) {
  const toast = useToast();
  const [commission, setCommission] = useState<number | null>(Math.round(ctx.cafe.card_commission_rate * 10000) / 100);
  const [vat, setVat] = useState<number | null>(Math.round((ctx.cafe.vat_rate ?? 0.1) * 10000) / 100);
  const [ticket, setTicket] = useState<number | null>(Math.round((ctx.cafe.ticket_commission_rate ?? 0) * 10000) / 100);
  const [openHour, setOpenHour] = useState(ctx.cafe.open_hour);
  const [closeHour, setCloseHour] = useState(ctx.cafe.close_hour);
  const [timezone, setTimezone] = useState(ctx.cafe.timezone);
  const [cashCount, setCashCount] = useState(ctx.cafe.cash_count);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [resetting, setResetting] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const saveSettings = async () => {
    if (commission === null) return toast.show("Komisyon oranını gir", "error");
    if (vat === null) return toast.show("KDV oranını gir", "error");
    setSaving(true);
    const result = await updateCafeSettingsAction(ctx.cafe.id, {
      commissionPercent: commission,
      vatPercent: vat,
      ticketPercent: ticket ?? 0,
      openHour,
      closeHour,
      timezone,
      cashCount,
    }).catch(() => null);
    setSaving(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Ayarlar kaydedildi");
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    const result = await removeMemberAction(ctx.cafe.id, removing.user_id).catch(() => null);
    setSaving(false);
    setRemoving(null);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Kişi ekipten çıkarıldı");
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <PageHeader title="Ayarlar ve ekip" description={ctx.cafe.name} />

      <ProfileCard ctx={ctx} />

      <Card className="mt-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clock className="size-5 text-brand-600" /> Çalışma düzeni
            </span>
          }
          description="Komisyon ve KDV oranı yeni ödemelere uygulanır; geçmiş ödemeler değişmez."
        />
        <div className="grid gap-4 px-4 pb-5 pt-4 sm:grid-cols-2 sm:px-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kart komisyonu" hint="Banka POS komisyonu">
              <NumberInput value={commission} onValueChange={setCommission} suffix="%" decimals={2} />
            </Field>
            <Field label="KDV" hint="Fiyatlara dahil">
              <NumberInput value={vat} onValueChange={setVat} suffix="%" decimals={2} />
            </Field>
            <Field label="Ticket komisyonu" hint="Yemek kartı kesintisi">
              <NumberInput value={ticket} onValueChange={setTicket} suffix="%" decimals={2} placeholder="0" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Açılış">
              <Select value={openHour} onChange={(e) => setOpenHour(Number(e.target.value))}>
                {HOURS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kapanış">
              <Select value={closeHour} onChange={(e) => setCloseHour(Number(e.target.value))}>
                {HOURS.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h === 24 ? "24:00 (gece yarısı)" : `${String(h).padStart(2, "0")}:00`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Saat dilimi">
            <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((z) => (
                <option key={z} value={z}>
                  {z.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <p className="self-end text-[12px] text-stone-500">
            Açılış–kapanış saatleri yoğunluk analizinde kullanılır: bu aralıkta hiç sipariş gelmeyen saatler de “sakin” sayılır. Gece 05:00’e
            kadarki satışlar önceki güne yazılır.
          </p>
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:col-span-2">
            <Toggle
              checked={cashCount}
              onChange={setCashCount}
              label="Açılış ve kapanışta kasa sayımı"
              description={
                cashCount
                  ? "Satıştan önce “Kafeyi aç” (açılış nakdi), gece “Kafeyi kapat” (sayılan nakit ve POS toplamı) sorulur; beklenenle farkı kaydedilir. Sayım istenirse pas geçilebilir."
                  : "Kapalı: kafe çalışma saatlerinde kendiliğinden açık sayılır; açıp kapatmak ya da kasa saymak gerekmez."
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={saveSettings} disabled={saving || closeHour <= openHour}>
              Kaydet
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="size-5 text-brand-600" /> Ekip
            </span>
          }
          description="Her kişi yalnızca eklendiği kafeleri görür. Hesaplar e-posta ve şifreyle giriş yapar."
          action={
            <Button size="sm" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Kişi ekle
            </Button>
          }
        />
        <ul className="mt-3 divide-y divide-stone-100">
          {team.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-900 text-[15px] font-bold text-white">
                {(m.display_name || m.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold">{m.display_name || m.email}</span>
                  {m.is_self && <Badge tone="dark">Sen</Badge>}
                </span>
                <span className="block truncate text-[13px] text-stone-500">{m.email}</span>
                {m.role !== "owner" && <PermissionSummary value={effectivePermissions(m.role, m.custom_permissions)} className="mt-1.5" />}
              </span>
              <Badge tone={m.role === "owner" ? "brand" : m.role === "manager" ? "amber" : "neutral"}>{ROLE_INFO[m.role].label}</Badge>
              <div className="flex gap-1">
                <IconAction label="Düzenle" onClick={() => setEditing(m)}>
                  <Pencil className="size-4" />
                </IconAction>
                <IconAction label="Şifre belirle" onClick={() => setResetting(m)}>
                  <KeyRound className="size-4" />
                </IconAction>
              </div>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border-t border-stone-100 px-4 py-4 text-[13px] sm:grid-cols-3 sm:px-5">
          {(Object.keys(ROLE_INFO) as Role[]).map((r) => (
            <div key={r} className="rounded-xl bg-stone-50 px-3 py-2">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="size-4 text-stone-500" /> {ROLE_INFO[r].label}
              </p>
              <p className="mt-0.5 text-stone-600">{ROLE_INFO[r].description}</p>
            </div>
          ))}
        </div>
      </Card>

      {demo && <DemoCard cafeId={ctx.cafe.id} cafeSlug={ctx.cafe.slug} cafeName={ctx.cafe.name} demo={demo} />}

      {localMode && (
        <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-[13px] text-stone-600">
          Yerel geliştirme veritabanındasın. Supabase bağlıyken hesaplar Supabase Auth&apos;ta tutulur.
        </p>
      )}

      {adding && <AddMemberWizard cafeId={ctx.cafe.id} onClose={() => setAdding(false)} />}
      {editing && <EditMemberSheet cafeId={ctx.cafe.id} member={editing} onClose={() => setEditing(null)} onRemove={() => { setRemoving(editing); setEditing(null); }} />}
      {resetting && <ResetPasswordSheet cafeId={ctx.cafe.id} member={resetting} onClose={() => setResetting(null)} />}
      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${removing?.display_name || removing?.email} ekipten çıkarılsın mı?`}
        description="Bu kafeye erişimi hemen kapanır. Hesabı silinmez; başka kafelerdeki üyeliği sürer."
        confirmLabel="Çıkar"
      />
    </main>
  );
}

function DemoCard({ cafeId, cafeSlug, cafeName, demo }: { cafeId: string; cafeSlug: string; cafeName: string; demo: DemoStatus }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const has = demo.orders > 0 || demo.expenses > 0;

  const regenerate = async () => {
    setBusy(true);
    const result = await refreshDemoDataAction(cafeSlug).catch(() => null);
    setBusy(false);
    setConfirmRefresh(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(`${result.data.orders} test adisyonu yüklendi`);
  };

  const purge = async () => {
    setBusy(true);
    const result = await purgeDemoDataAction(cafeId).catch(() => null);
    setBusy(false);
    setConfirm(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(`${result.data.orders} test adisyonu ve ${result.data.expenses} test gideri silindi`);
  };

  return (
    <>
      <Card className="mt-4 border-amber-200 bg-amber-50/40">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <FlaskConical className="size-5 text-amber-600" /> Test verisi
            </span>
          }
          description={
            has
              ? `${cafeName} kafesinde tanıtım için yüklenmiş ${demo.orders} test adisyonu var. Gerçek satışlar (${demo.real_orders}) bu işlemden etkilenmez.`
              : "Bu kafede test verisi kalmadı."
          }
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmRefresh(true)}>
                <RefreshCw className="size-4" /> {has ? "Bugüne göre yenile" : "Test verisi yükle"}
              </Button>
              {has && (
                <Button variant="secondary" size="sm" className="text-red-700" onClick={() => setConfirm(true)}>
                  <Trash2 className="size-4" /> Test verilerini sil
                </Button>
              )}
            </div>
          }
        />
        <p className="px-4 pb-4 pt-3 text-[13px] text-stone-600 sm:px-5">
          Sunumdan önce “Bugüne göre yenile”ye bas: son 60 günün ve bugünün o saate kadarki satışları, dolu masalarla birlikte yeniden
          üretilir. Gerçek işletmeye geçerken test verilerini sil ve Vercel’de{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-[12px]">NEXT_PUBLIC_DEMO_MODE</code> değişkenini kaldır; “Test” rozeti ve
          bu panel kaybolur.
        </p>
      </Card>

      <ConfirmSheet
        open={confirmRefresh}
        onClose={() => setConfirmRefresh(false)}
        onConfirm={regenerate}
        pending={busy}
        title="Test verisi bugüne göre yenilensin mi?"
        description="Var olan test adisyonları ve giderleri silinip son 60 gün ve bugün için yeniden üretilir (birkaç saniye sürer). Gerçek satışlara dokunulmaz."
        confirmLabel="Yenile"
      />

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={purge}
        pending={busy}
        danger
        title="Test verileri silinsin mi?"
        description={`${demo.orders} test adisyonu ve ${demo.expenses} test gideri kalıcı olarak silinecek. Gerçek satışlara dokunulmaz. Bu işlem geri alınamaz.`}
        confirmLabel="Evet, sil"
      />
    </>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
      {children}
    </button>
  );
}

function EditMemberSheet({ cafeId, member, onClose, onRemove }: { cafeId: string; member: TeamMember; onClose: () => void; onRemove: () => void }) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(member.display_name);
  const [role, setRole] = useState<Role>(member.role);
  const [perms, setPerms] = useState<Permissions>(() => effectivePermissions(member.role, member.custom_permissions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rol değişince yetkiler o rolün önerilen ayarlarına döner
  const chooseRole = (r: Role) => {
    setRole(r);
    setPerms(ROLE_DEFAULTS[r]);
  };

  const save = async () => {
    setSaving(true);
    const result = await updateMemberAction(cafeId, member.user_id, {
      role,
      displayName,
      permissions: role === "owner" ? undefined : customPart(role, perms),
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.error);
    toast.show("Üye güncellendi");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={member.display_name || member.email}
      description={member.email}
      size="md"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="text-red-600" onClick={onRemove}>
              Ekipten çıkar
            </Button>
            <Button size="lg" className="flex-1" onClick={save} disabled={saving}>
              Kaydet
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Ad">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Görevi">
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLE_CHOICES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={role === r.value}
                onClick={() => chooseRole(r.value)}
                className={cn("rounded-xl border-2 px-3 py-2 text-left", role === r.value ? "border-brand-500 bg-brand-50" : "border-stone-200")}
              >
                <span className="block text-[14px] font-semibold">{r.label}</span>
                <span className="block text-[11.5px] leading-snug text-stone-500">{r.description}</span>
              </button>
            ))}
          </div>
        </Field>
        {role === "owner" ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Sahip her şeyi görür ve yapar: finans, ekip ve ayarlar dahil.</p>
        ) : (
          <PermissionQuestions value={perms} onChange={setPerms} />
        )}
      </div>
    </Sheet>
  );
}

function ResetPasswordSheet({ cafeId, member, onClose }: { cafeId: string; member: TeamMember; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    const result = await resetPasswordAction(cafeId, member.user_id, password).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.error);
    toast.show("Şifre güncellendi");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Şifre belirle"
      description={member.email}
      size="sm"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
          <Button size="lg" className="w-full" onClick={save} disabled={saving || password.length < 6}>
            Şifreyi kaydet
          </Button>
        </div>
      }
    >
      <Field label="Yeni şifre" hint="En az 6 karakter, harf ve rakam. Kişiye güvenli bir yoldan ilet.">
        <div className="flex gap-2">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="font-mono" autoFocus />
          <Button variant="secondary" onClick={() => setPassword(generatePassword())}>
            Oluştur
          </Button>
        </div>
      </Field>
    </Sheet>
  );
}
