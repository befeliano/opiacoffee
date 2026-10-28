"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ show: (message: string, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === "error" ? 5000 : 2600);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 pt-safe"
      >
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? CircleAlert : Info;
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex max-w-md animate-slide-up items-center gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-medium shadow-float",
                t.kind === "error" ? "bg-red-600 text-white" : "bg-stone-900 text-white",
              )}
            >
              <Icon className={cn("size-5 shrink-0", t.kind === "success" && "text-brand-400")} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalı");
  return ctx;
}
