import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <LogoMark size={64} />
      <h1 className="text-2xl font-extrabold">Sayfa bulunamadı</h1>
      <p className="max-w-sm text-[15px] text-stone-500">Aradığın sayfa yok ya da bu kafeye erişim yetkin bulunmuyor.</p>
      <Link href="/" className="mt-2 rounded-xl bg-brand-600 px-5 py-3 text-[15px] font-semibold text-white hover:bg-brand-700">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
