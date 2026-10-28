import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Her istekte:
//  1) Tahmin edilemez nonce ile sıkı Content-Security-Policy üretir (XSS koruması)
//  2) Supabase modunda oturum çerezlerini yeniler
//  3) Oturumsuz ziyaretçiyi giriş sayfasına yönlendirir (iyimser kontrol;
//     asıl yetki kontrolü veritabanı fonksiyonlarındadır)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const USE_SUPABASE =
  process.env.DATA_BACKEND === "supabase" ||
  (!process.env.DATA_BACKEND && !process.env.DATABASE_URL && !!SUPABASE_URL && !!SUPABASE_KEY);
const LOCAL_SESSION_COOKIE = "ad_session";
const PUBLIC_PATHS = ["/giris", "/robots.txt", "/manifest.webmanifest"];

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const supabaseOrigin = USE_SUPABASE && SUPABASE_URL ? new URL(SUPABASE_URL).origin : "";
  const supabaseWs = supabaseOrigin.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Hava durumu doğrudan tarayıcıdan (Open-Meteo, anahtarsız) — Vercel'e yük binmez
    `connect-src 'self' https://api.open-meteo.com${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseWs}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// ---------------------------------------------------------------------
// Tanıtım sitesi (opiacoffee.com.tr) ile panel (panel.opiacoffee.com.tr) aynı uygulamada çalışır.
// Site alan adından gelen istekler src/app/(site)/web altına yeniden yazılır.
// APP_MODE=site|panel ile alan adından bağımsız zorlanabilir (iki ayrı Node uygulaması kurulursa).
// ---------------------------------------------------------------------
const SITE_HOSTS = (process.env.SITE_HOSTS ?? "opiacoffee.com.tr,www.opiacoffee.com.tr,opia.localhost")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
const SITE_PREFIX = "/web";
// public klasöründen doğrudan sunulan site dosyaları (yeniden yazılmaz)
const SITE_STATIC = /^\/(assets|uploads)\/|^\/favicon\.svg$/;

function isSiteRequest(request: NextRequest) {
  if (process.env.APP_MODE === "site") return true;
  if (process.env.APP_MODE === "panel") return false;
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return SITE_HOSTS.includes(host);
}

function buildSiteCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://www.googletagmanager.com https://*.google-analytics.com",
    "font-src 'self'",
    "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    "frame-src https://www.openstreetmap.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function siteProxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (SITE_STATIC.test(pathname)) return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildSiteCsp(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  headers.set("x-site-lang", pathname === "/en" || pathname.startsWith("/en/") ? "en" : "tr");
  const url = request.nextUrl.clone();
  // /web/... doğrudan istenirse bulunamaz (iç yol)
  url.pathname = pathname.startsWith(`${SITE_PREFIX}/`) || pathname === SITE_PREFIX ? "/_yok" : SITE_PREFIX + (pathname === "/" ? "" : pathname);
  const response = NextResponse.rewrite(url, { request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request: NextRequest) {
  if (isSiteRequest(request)) return siteProxy(request);
  // Site yolları panel alan adından açılmaz
  if (request.nextUrl.pathname === SITE_PREFIX || request.nextUrl.pathname.startsWith(`${SITE_PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = "/_yok";
    return NextResponse.rewrite(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const forwardHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: forwardHeaders() } });
  let authenticated = false;

  if (USE_SUPABASE) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: forwardHeaders() } });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    // getClaims oturumu doğrular ve gerekirse belirteci yeniler
    const { data } = await supabase.auth.getClaims();
    authenticated = !!data?.claims?.sub;
  } else {
    authenticated = request.cookies.has(LOCAL_SESSION_COOKIE);
  }

  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAction = request.method === "POST" && request.headers.has("next-action");

  if (!authenticated && !isPublic && !isAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.search = pathname === "/" ? "" : `?sonra=${encodeURIComponent(pathname + search)}`;
    return withCookies(NextResponse.redirect(url), response, csp);
  }

  // Son kullanılan kafeyi hatırla (ana sayfa doğrudan oraya açılır)
  const cafeMatch = pathname.match(/^\/([a-z0-9-]{1,40})\/(?:masalar|gecmis|rapor|z-raporu|urunler|analiz|menu|masa-duzeni|finans|ayarlar)(?:\/|$)/);
  if (cafeMatch && request.cookies.get("ad_last_cafe")?.value !== cafeMatch[1]) {
    response.cookies.set("ad_last_cafe", cafeMatch[1], { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Yönlendirme yanıtına, yenilenmiş oturum çerezlerini de taşı
function withCookies(target: NextResponse, source: NextResponse, csp: string) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  target.headers.set("Content-Security-Policy", csp);
  return target;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|icons/|brand/|favicon.ico|icon.png|apple-icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
