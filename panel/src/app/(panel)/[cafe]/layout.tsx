import type { Metadata, Viewport } from "next";
import { AppNav } from "@/components/shell/app-nav";
import { FormatConfig } from "@/components/shell/format-config";
import { PermsProvider } from "@/components/shell/perms";
import { THEME_COLOR } from "@/components/brand/themes";
import { getCafeContext } from "@/lib/data/cafe";
import { isLocalMode } from "@/lib/data/server";

export async function generateMetadata({ params }: LayoutProps<"/[cafe]">): Promise<Metadata> {
  const { cafe } = await params;
  const ctx = await getCafeContext(cafe);
  return { title: { default: ctx.cafe.name, template: `%s · ${ctx.cafe.name}` } };
}

export async function generateViewport({ params }: LayoutProps<"/[cafe]">): Promise<Viewport> {
  const { cafe } = await params;
  const ctx = await getCafeContext(cafe);
  return { themeColor: THEME_COLOR[ctx.cafe.theme] ?? THEME_COLOR.coffee };
}

export default async function CafeLayout({ children, params }: LayoutProps<"/[cafe]">) {
  const { cafe } = await params;
  const [ctx, local] = await Promise.all([getCafeContext(cafe), isLocalMode()]);

  return (
    <div data-cafe-theme={ctx.cafe.theme} className="min-h-dvh bg-paper md:pl-[84px]">
      <FormatConfig currency={ctx.cafe.currency} language={ctx.cafe.language} />
      <PermsProvider value={ctx.permissions}>
        <AppNav
          cafe={{ slug: ctx.cafe.slug, name: ctx.cafe.name, theme: ctx.cafe.theme, logo: ctx.cafe.logo }}
          cafes={ctx.cafes}
          role={ctx.role}
          userLabel={ctx.user.display_name || ctx.user.email}
          localMode={local}
        />
        {children}
      </PermsProvider>
    </div>
  );
}
