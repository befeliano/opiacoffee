import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { APP_NAME, DEMO_MODE } from "@/config";
import { getBrand, getSessionUser } from "@/lib/data/server";
import { DemoLogin } from "./demo-login";
import { LoginGuide } from "./guide";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const [user, brand] = await Promise.all([getSessionUser(), getBrand()]);
  const { sonra } = await searchParams;
  if (user) redirect("/");
  const next = typeof sonra === "string" ? sonra : undefined;

  return (
    <main data-cafe-theme={brand.theme ?? "coffee"} className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-cream px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[420px] rounded-full bg-brand-500/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[380px] rounded-full bg-brand-300/20 blur-3xl" />

      <div className="relative w-full max-w-[400px] animate-fade-in">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark size={96} logo={brand.logo} name={brand.name} className="shadow-float ring-4 ring-white" />
          <h1 className="mt-5 text-[26px] font-extrabold tracking-tight text-stone-900">{brand.name || APP_NAME}</h1>
          <p className="mt-1 text-[14px] text-stone-500">Adisyon, maliyet ve kafe analizi</p>
        </div>

        {DEMO_MODE && <DemoLogin next={next} />}

        <div className="rounded-3xl border border-stone-200/70 bg-white p-6 shadow-float sm:p-7">
          <LoginForm next={next} />
        </div>

        <LoginGuide />
      </div>
    </main>
  );
}
