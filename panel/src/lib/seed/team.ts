// Demo ekip. Kurulumda bu hesaplar oluşturulur; sonradan Ayarlar ›
// Ekip ekranından değiştirilebilir. Gerçek bir kafe kurulurken bu
// listeyi kafenin kendi ekibiyle değiştir (ya da yalnızca sahibi bırak,
// diğerlerini uygulamadan ekle).
//
// Roller:
//  owner   → her şey (ciro, raporlar, analiz, finans, ekip, ayarlar)
//  manager → satış + menü/maliyet + raporlar (finans ve ekip hariç)
//  staff   → satış ekranı ve günün adisyonları

import type { Role } from "@/lib/api/types";

export interface TeamMemberSeed {
  key: string;
  email: string;
  name: string;
  /** Kurulumda atanan ilk parola — herkes Ayarlar › Ekip'ten değiştirebilir */
  password: string;
  memberships: { slug: string; role: Role }[];
}

export const EMAIL_DOMAIN = "demo.cafe";

export const TEAM: TeamMemberSeed[] = [
  { key: "sahip", email: `sahip@${EMAIL_DOMAIN}`, name: "Selin", password: "demo-sahip", memberships: [{ slug: "kafe", role: "owner" }] },
  { key: "mudur", email: `mudur@${EMAIL_DOMAIN}`, name: "Kerem", password: "demo-mudur", memberships: [{ slug: "kafe", role: "manager" }] },
  { key: "barista", email: `barista@${EMAIL_DOMAIN}`, name: "Ayşe", password: "demo-barista", memberships: [{ slug: "kafe", role: "staff" }] },
  { key: "barista2", email: `barista2@${EMAIL_DOMAIN}`, name: "Mert", password: "demo-barista2", memberships: [{ slug: "kafe", role: "staff" }] },
];

/** Giriş ekranındaki "Demo olarak dene" düğmelerinin açtığı hesaplar (yalnızca demo modunda) */
export const DEMO_LOGINS: { key: string }[] = [{ key: "sahip" }, { key: "barista" }];

/** Yerel modda da aynı parolalar kullanılır */
export const LOCAL_PASSWORD = (key: string) => TEAM.find((m) => m.key === key)?.password ?? `${key}123`;
