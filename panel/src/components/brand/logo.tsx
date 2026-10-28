import { Coffee } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kafe logosu. Kafe kendi logosunu yüklediyse onu (yuvarlak kırpılmış),
 * yüklemediyse marka renginde kahve fincanı simgesini gösterir.
 */
export function LogoMark({
  size = 40,
  logo,
  name,
  className,
}: {
  size?: number;
  /** Yüklenen logo (data: URL) */
  logo?: string | null;
  name?: string;
  className?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data: URL, optimize edilecek bir şey yok
      <img
        src={logo}
        alt={name ?? ""}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full bg-white object-cover ring-1 ring-stone-200/70", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name ?? "Logo"}
      className={cn("grid shrink-0 place-items-center rounded-full bg-brand-600 text-white ring-1 ring-brand-700/20", className)}
      style={{ width: size, height: size }}
    >
      <Coffee style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} aria-hidden />
    </span>
  );
}
