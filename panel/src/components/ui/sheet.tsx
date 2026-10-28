"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// Açık panel sayısı: iç içe açıldığında sayfa kaydırma kilidi doğru kalkar
let openCount = 0;

function lockScroll() {
  openCount += 1;
  if (openCount === 1) document.documentElement.classList.add("sheet-open");
}

function unlockScroll() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.documentElement.classList.remove("sheet-open");
}

/**
 * Mobilde alttan açılan, geniş ekranda ortada duran modal panel.
 * Tarayıcının <dialog> öğesine dayanmaz (eski iOS ve bazı Android tarayıcılarında
 * sorun çıkarıyordu); body'ye taşınan sabit bir katman olarak çizilir.
 * Esc ve arka plana dokunma paneli kapatır; kapanınca odak geri döner.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    lockScroll();
    // autoFocus'lu bir alan yoksa odağı panele al (klavye ve ekran okuyucu için)
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Yalnızca en üstteki panel kapansın
      const panels = document.querySelectorAll("[data-sheet-panel]");
      if (panels[panels.length - 1] === panelRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockScroll();
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        data-sheet-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "sheet-max-h relative flex w-full animate-sheet-in flex-col overflow-hidden rounded-t-3xl bg-white text-stone-900 shadow-float outline-none",
          "sm:rounded-3xl",
          widths[size],
          className,
        )}
      >
        {(title || description) && (
          <header className="flex shrink-0 items-start gap-3 border-b border-stone-100 px-5 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-stone-200 sm:hidden" aria-hidden />
              {title && (
                <h2 id={titleId} className="truncate text-lg font-bold leading-tight">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="-mr-2 mt-1 grid size-9 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
            >
              <X className="size-5" />
            </button>
          </header>
        )}
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4", footer ? "pb-4" : "pb-safe-4")}>{children}</div>
        {footer && <footer className="shrink-0 border-t border-stone-100 bg-white px-5 pt-3 pb-safe-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Onayla",
  danger,
  pending,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl border border-stone-200 font-semibold text-stone-700 hover:bg-stone-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "h-12 flex-1 rounded-xl font-semibold text-white disabled:opacity-60",
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700",
            )}
          >
            {pending ? "Bekleyin…" : confirmLabel}
          </button>
        </div>
      }
    >
      {description && <p className="text-[15px] text-stone-600">{description}</p>}
      {children}
    </Sheet>
  );
}
