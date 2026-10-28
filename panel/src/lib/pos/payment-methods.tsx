import { Banknote, CreditCard, Ticket } from "lucide-react";
import type { PaymentMethod } from "@/lib/api/types";

export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "ticket"];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Nakit",
  card: "Kart",
  ticket: "Ticket",
};

/** "… çevir" düğmeleri için yönelme ekiyle */
export const METHOD_SWITCH_LABEL: Record<PaymentMethod, string> = {
  cash: "Nakite çevir",
  card: "Karta çevir",
  ticket: "Ticket’a çevir",
};

export function MethodIcon({ method, className }: { method: PaymentMethod; className?: string }) {
  const Icon = method === "card" ? CreditCard : method === "ticket" ? Ticket : Banknote;
  return <Icon className={className} />;
}
