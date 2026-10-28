import type { MetadataRoute } from "next";
import { APP_NAME } from "@/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Adisyon, maliyet ve analiz",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fdfbf8",
    theme_color: "#8a5a3b",
    lang: "tr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
