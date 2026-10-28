"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { decimalInput, parseDecimal } from "@/lib/format";

export const inputClass =
  "h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-[15px] text-stone-900 shadow-card outline-none transition placeholder:text-stone-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 disabled:bg-stone-50 disabled:text-stone-500";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-stone-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[13px] font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "h-auto min-h-20 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClass, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: CHEVRON }} {...props}>
      {children}
    </select>
  );
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

/**
 * Ondalık sayı girişi (Türkçe virgül destekli). Değer sayı olarak yukarı iletilir.
 */
export function NumberInput({
  value,
  onValueChange,
  suffix,
  decimals = 2,
  className,
  inputClassName,
  allowNegative = false,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  suffix?: ReactNode;
  decimals?: number;
  inputClassName?: string;
  allowNegative?: boolean;
}) {
  const [text, setText] = useState(() => decimalInput(value, decimals));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parseDecimal(text) !== value) setText(decimalInput(value, decimals));
  }
  const id = useId();
  return (
    <div className={cn("relative", className)}>
      <input
        id={props.id ?? id}
        inputMode="decimal"
        autoComplete="off"
        className={cn(inputClass, "tabular-nums", suffix ? "pr-12" : "", inputClassName)}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^-?[\d.,]*$/.test(raw) || (!allowNegative && raw.startsWith("-"))) return;
          setText(raw);
          const parsed = parseDecimal(raw);
          setLastValue(parsed);
          onValueChange(parsed);
        }}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-stone-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed opacity-60")}>
      <span className="flex flex-col">
        <span className="text-[15px] font-medium text-stone-800">{label}</span>
        {description && <span className="text-[13px] text-stone-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-brand-600" : "bg-stone-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
