import { SITE } from "@/site/config";

export function GET() {
  return Response.json(
    {
      name: SITE.name,
      short_name: "Opia",
      description: SITE.tagline,
      start_url: "/",
      scope: "/",
      display: "standalone",
      lang: "tr",
      background_color: "#ffffff",
      theme_color: SITE.themeColor,
      icons: [{ src: "/assets/img/logo-opia.png", sizes: "225x225", type: "image/png", purpose: "any" }],
    },
    { headers: { "Content-Type": "application/manifest+json; charset=utf-8" } },
  );
}
