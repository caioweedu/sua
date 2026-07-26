import type { Metadata } from "next";
import "./globals.css";
import { resolveTenant, tenantThemeStyle } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Sua — Plataforma de Treinamentos",
  description: "Universidade corporativa white-label da Weedu",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await resolveTenant();
  const style = tenant
    ? tenantThemeStyle(tenant)
    : ({} as React.CSSProperties);

  return (
    <html lang="pt-BR">
      <body style={style}>{children}</body>
    </html>
  );
}
