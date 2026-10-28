import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-stone-200/80 bg-white shadow-card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 sm:px-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold text-stone-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "green" | "red" | "amber" | "dark";
  className?: string;
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    brand: "bg-brand-100 text-brand-800",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-800",
    dark: "bg-stone-900 text-white",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>}
      <p className="text-[15px] font-bold text-stone-800">{title}</p>
      {description && <p className="max-w-sm text-[14px] text-stone-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-stone-100 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg font-semibold transition",
            size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
            o.value === value ? "bg-white text-stone-900 shadow-card" : "text-stone-500 hover:text-stone-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
