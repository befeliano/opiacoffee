// Opia tanıtım sitesinin sabit bilgileri. Adres, saat, sosyal medya burada değişir; sayfalar buradan okur.

export const SITE = {
  name: "Opia Coffee Co.",
  short: "OPIA",
  /** Canlı alan adı; SITE_URL ortam değişkeniyle değiştirilebilir */
  url: (process.env.SITE_URL ?? "https://opiacoffee.com.tr").replace(/\/+$/, ""),
  tagline: "Yenibağlar, Eskişehir’de nitelikli kahve",
  instagram: "opiacoffeeco",
  /** Boşsa sitede hiç gösterilmez */
  phone: "",
  email: "",
  address: {
    street: "Eti Cd. No:41/C",
    hood: "Yenibağlar Mah.",
    district: "Tepebaşı",
    city: "Eskişehir",
    zip: "26170",
    country: "TR",
  },
  geo: { lat: 39.78545388328983, lng: 30.50237731156014 },
  mapsUrl: "https://maps.app.goo.gl/KKHjZvkypfuQQUkt8",
  hours: { open: "09:00", close: "00:00" },
  themeColor: "#0a0a0a",
  /** Adisyondaki kafe kısa adı (menü ve QR sipariş bu kafeden okunur) */
  cafeSlug: process.env.SITE_CAFE_SLUG ?? "opia",
  /** Google Analytics ölçüm kimliği (G-XXXX). Boşsa hiç yüklenmez. */
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
  /** Geçici adreste (ör. vercel.app) arama motorlarına kapalı: SITE_NOINDEX=1 */
  noindex: process.env.SITE_NOINDEX === "1",
  /** Search Console doğrulama kodu (isteğe bağlı) */
  gscVerify: process.env.GSC_VERIFY ?? "",
  /** Büyük harfe çevrilen alanlarda Türkçe i/İ kuralı bozulmasın diye lang="en" ile sarılan sözcükler */
  enWords: ["Opia", "opiacoffeeco", "Instagram", "San Sebastian", "Tiramisu", "Cappuccino", "Americano", "Piccolo", "Brownie", "Chai", "Miel", "Flat White", "Red Eye", "Black Eye", "Cheesecake", "Gingerbread", "Pistachio", "Matcha Bar", "Single", "Awaken the senses", "Cold Brew", "Mocha", "White", "Eye"],
  /** İngilizce sayfalarda lang="tr" ile sarılan yer adları */
  trWords: ["Yenibağlar", "Eskişehir", "Tepebaşı", "Hoşnudiye", "Eti Caddesi", "Eti Cd.", "Vecihi Hürkuş", "Anadolu Üniversitesi", "Yunusemre", "İstasyon", "Bağlar", "Mah.", "Türkçe"],
};

export type Lang = "tr" | "en";

export const url = (path = "/") => SITE.url + path;

export const mapsDirUrl = () => `https://www.google.com/maps/dir/?api=1&destination=${SITE.geo.lat},${SITE.geo.lng}`;

export const addressLine = () => {
  const a = SITE.address;
  return `${a.hood}, ${a.street}, ${a.district}/${a.city}`;
};

export function money(n: number): string {
  const whole = Math.floor(n) === n;
  return `${n.toLocaleString("tr-TR", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })} ₺`;
}

/** Türkçe ve İngilizce sayfa eşleri */
export const PAGE_PAIRS: Record<string, string> = {
  "/": "/en",
  "/menu": "/en/menu",
  "/hakkimizda": "/en/about",
  "/iletisim": "/en/contact",
  "/kvkk-aydinlatma-metni": "/en/personal-data-notice",
  "/gizlilik-politikasi": "/en/privacy-policy",
  "/cerez-politikasi": "/en/cookie-policy",
  "/kullanim-kosullari": "/en/terms",
};

/** Türkçe yolu sayfanın diline çevirir: lp("/menu", "en") → /en/menu */
export function lp(trPath: string, lang: Lang): string {
  if (lang !== "en") return trPath;
  const [p, hash] = trPath.split("#");
  return (PAGE_PAIRS[p] ?? p) + (hash !== undefined ? `#${hash}` : "");
}

/** Sayfanın diğer dildeki eşi (yoksa null) */
export function altPath(path: string): string | null {
  if (PAGE_PAIRS[path]) return PAGE_PAIRS[path];
  const tr = Object.keys(PAGE_PAIRS).find((k) => PAGE_PAIRS[k] === path);
  return tr ?? null;
}
