"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-2xl">☕</div>
      <h1 className="text-xl font-extrabold">Bir şeyler ters gitti</h1>
      <p className="max-w-sm text-[15px] text-stone-500">Sayfa yüklenirken bir hata oluştu. Bağlantını kontrol edip tekrar dene.</p>
      {error.digest && <p className="text-[12px] text-stone-400">Hata kodu: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={reset} className="rounded-xl bg-brand-600 px-5 py-3 text-[15px] font-semibold text-white hover:bg-brand-700">
          Tekrar dene
        </button>
        <Link href="/" className="rounded-xl border border-stone-200 px-5 py-3 text-[15px] font-semibold text-stone-700 hover:bg-stone-50">
          Ana sayfa
        </Link>
      </div>
    </main>
  );
}
