import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { logoutAction } from "@/app/(panel)/giris/actions";
import type { CafeSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { getSessionUser, rpc } from "@/lib/data/server";

const ROLE_LABEL = { owner: "Sahip", manager: "Müdür", staff: "Barista" } as const;

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/giris");

  const cafes = await rpc<CafeSummary[]>("app_my_cafes");
  const last = (await cookies()).get("ad_last_cafe")?.value;
  const target = cafes.find((c) => c.slug === last) ?? (cafes.length === 1 ? cafes[0] : null);
  if (target) redirect(`/${target.slug}/masalar`);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold">Hangi kafe?</h1>
          <p className="text-[14px] text-stone-500">{user.email}</p>
        </div>

        {cafes.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-card">
            <p className="font-semibold">Henüz bir kafeye eklenmedin.</p>
            <p className="mt-1 text-[14px] text-stone-500">Kafe sahibi seni Ayarlar › Ekip’ten ekleyebilir.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {cafes.map((cafe) => (
              <li key={cafe.id} data-cafe-theme={cafe.theme}>
                <Link prefetch={false}
                  href={`/${cafe.slug}/masalar`}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border-2 bg-white p-4 shadow-card transition hover:shadow-float",
                    "border-brand-200 hover:border-brand-400",
                  )}
                >
                  <LogoMark size={56} logo={cafe.logo} name={cafe.name} className="ring-0" />
                  <span className="flex-1">
                    <span className="block text-[17px] font-bold text-stone-900">{cafe.name}</span>
                    <span className="text-[13px] font-semibold text-brand-700">{ROLE_LABEL[cafe.role]}</span>
                  </span>
                  <ChevronRight className="size-5 text-brand-600 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <form action={logoutAction} className="mt-6 text-center">
          <button type="submit" className="text-[14px] font-semibold text-stone-500 hover:text-stone-800">
            Çıkış yap
          </button>
        </form>
      </div>
    </main>
  );
}
