"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ROLE_DEFAULTS, type Permissions } from "@/lib/permissions";

// Oturumdaki kişinin yetkileri (kafe düzeninden). Yalnızca düğmeleri gizlemek
// içindir; asıl kontrol veritabanı fonksiyonlarındadır.
const PermsContext = createContext<Permissions>(ROLE_DEFAULTS.staff);

export function PermsProvider({ value, children }: { value: Permissions; children: ReactNode }) {
  return <PermsContext.Provider value={value}>{children}</PermsContext.Provider>;
}

export function usePerms(): Permissions {
  return useContext(PermsContext);
}
