"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="E-posta" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            defaultValue={state.email}
            placeholder="ad@kafe.com"
          />
        </Field>
        <Field label="Şifre" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
        </Field>

        {state.error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[14px] font-medium text-red-700">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? <Spinner /> : <LogIn className="size-5" />}
          Giriş yap
        </Button>
      </form>

    </>
  );
}
