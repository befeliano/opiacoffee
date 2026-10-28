"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_COOKIE = "ad_theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Otomatik", icon: Monitor },
];

function currentChoice(): ThemeChoice {
  if (typeof document === "undefined") return "light";
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "system" ? value : "light";
}

function applyTheme(value: ThemeChoice) {
  document.documentElement.setAttribute("data-theme", value);
  // Çerez tarayıcıda yazılır; sunucu ilk çizimde bunu okur
  document.cookie = `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/** Açık / koyu / cihaza göre tema. Seçim çerezde saklanır; sayfa sunucuda doğru temayla gelir. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(currentChoice);

  const select = (value: ThemeChoice) => {
    setChoice(value);
    applyTheme(value);
  };

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          onClick={() => select(value)}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition",
            choice === value ? "bg-white text-stone-900 shadow-card" : "text-stone-500",
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
