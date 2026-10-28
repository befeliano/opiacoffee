import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "soft";
type Size = "sm" | "md" | "lg" | "xl" | "icon" | "icon-sm";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-card hover:bg-brand-700",
  secondary: "border border-stone-200 bg-white text-stone-800 shadow-card hover:border-stone-300 hover:bg-stone-50",
  ghost: "text-stone-700 hover:bg-stone-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  dark: "bg-stone-900 text-white hover:bg-stone-800",
  soft: "bg-brand-50 text-brand-800 hover:bg-brand-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
  xl: "h-14 px-6 text-lg",
  icon: "size-11",
  "icon-sm": "size-9",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  prefetch,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}
