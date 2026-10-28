"use client";

import { useActionState } from "react";
import { Crown, Coffee } from "lucide-react";
import { Spinner } from "@/components/ui/button";
import { demoLoginAction, type LoginState } from "./actions";

const CHOICES = [
  { key: "sahip", label: "Sahip olarak dene", hint: "Ciro, raporlar, menü, finans, ayarlar", icon: Crown },
  { key: "barista", label: "Barista olarak dene", hint: "Masalar, sipariş ve ödeme", icon: Coffee },
] as const;

/** Demo modunda tek dokunuşla hazır hesaba giriş (şifreler yalnızca sunucuda) */
export function DemoLogin({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(demoLoginAction, {});

  return (
    <div className="mb-4 rounded-3xl border-2 border-dashed border-brand-300 bg-brand-50/70 p-4">
      <p className="mb-3 text-center text-[13px] font-semibold text-brand-800">Demo · örnek verilerle hemen dene</p>
      <form action={formAction} className="grid grid-cols-2 gap-2">
        {next && <input type="hidden" name="next" value={next} />}
        {CHOICES.map(({ key, label, hint, icon: Icon }) => (
          <button
            key={key}
            type="submit"
            name="account"
            value={key}
            disabled={pending}
            className="flex flex-col items-center gap-1 rounded-2xl border border-brand-200 bg-white px-3 py-3 text-center shadow-card transition hover:border-brand-400 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? <Spinner /> : <Icon className="size-6 text-brand-600" />}
            <span className="text-[14px] font-bold text-stone-900">{label}</span>
            <span className="text-[11px] leading-tight text-stone-500">{hint}</span>
          </button>
        ))}
      </form>
      {state.error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-[13px] font-medium text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}
