/** @jsxImportSource @/site/jsx */
// Metin ağırlıklı sayfalar (hakkımızda, iletişim, yasal metinler) için ortak rota işleyicisi.

import type { Lang } from "./config";
import type { Html } from "./jsx/jsx-runtime";
import { renderPage } from "./shell";

export interface StaticPage {
  path: string;
  lang: Lang;
  title: string;
  description: string;
  business: boolean;
  breadcrumb: [string, string][];
  schema: unknown[];
}

/** Sayfa dosyasından (src/site/pages/*.tsx) GET işleyicisi üretir */
export function staticRoute(page: StaticPage, Content: () => Html) {
  return (request: Request) =>
    renderPage(request, {
      meta: page,
      content: <Content />,
      business: page.business,
      breadcrumb: page.breadcrumb.length ? page.breadcrumb : undefined,
      schema: page.schema,
    });
}
