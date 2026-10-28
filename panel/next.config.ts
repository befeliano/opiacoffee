import type { NextConfig } from "next";

// CSP (nonce'lu) src/proxy.ts içinde üretilir; buradakiler her yanıta
// eklenen sabit güvenlik başlıklarıdır.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Yerel geliştirme veritabanı (WASM) paketlenmeden Node ile yüklenir
  serverExternalPackages: ["@electric-sql/pglite"],
  // Üretim paketine yerel veritabanı dosyaları girmesin
  outputFileTracingExcludes: {
    "*": ["node_modules/@electric-sql/pglite/**", ".data/**", "docs/**"],
  },
  experimental: {
    // Sunucu eylemleri yalnızca aynı kökenden çağrılabilir (varsayılan);
    // gövde boyutu küçük tutulur.
    serverActions: { bodySizeLimit: "256kb" },
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
