"use client";

import { configureFormat } from "@/lib/format";

/**
 * Tarayıcıdaki para/sayı biçimini kafenin ayarına çeker. Kafe düzeninin ilk
 * çocuğu olarak çizilir; React kardeşleri sırayla çizdiği için sayfalar
 * çizilmeden önce çalışır.
 */
export function FormatConfig({ currency, language }: { currency: string; language: string }) {
  configureFormat({ currency, language });
  return null;
}
