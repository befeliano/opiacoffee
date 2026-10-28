import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { APP_NAME } from "@/config";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Kafeler için adisyon, maliyet ve analiz uygulaması.",
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#8a5a3b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema seçimi çerezde (Ayarlar/Daha menüsündeki düğme); ilk çizimde doğru tema gelsin
  const theme = (await cookies()).get("ad_theme")?.value;
  const dataTheme = theme === "dark" || theme === "system" ? theme : "light";
  return (
    <html lang="tr" data-theme={dataTheme} className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
