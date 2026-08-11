import "server-only";
import { headers, cookies } from "next/headers";
import { prisma } from "./db";

// Resolve o tenant a partir do host da requisição.
//
// Regras (MVP):
//  1. Se o host bater com um `customDomain` cadastrado, usa esse tenant.
//  2. Se for um subdomínio (<slug>.ROOT_DOMAIN), resolve pelo slug.
//  3. Caso contrário (ex.: localhost direto), cai no tenant mãe (MOTHER).
//
// Em produção, o apontamento de domínio personalizado é feito no DNS do cliente
// + configuração do host; aqui só fazemos o match no banco.
export async function resolveTenant() {
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase().split(":")[0];
  const rootDomain = (process.env.ROOT_DOMAIN ?? "localhost:3000").split(":")[0];

  if (host) {
    // 1. Domínio personalizado
    const byDomain = await prisma.tenant.findFirst({
      where: { customDomain: host, active: true },
    });
    if (byDomain) return byDomain;

    // 2. Subdomínio <slug>.rootDomain
    if (host.endsWith(`.${rootDomain}`)) {
      const slug = host.slice(0, host.length - rootDomain.length - 1);
      const bySlug = await prisma.tenant.findFirst({
        where: { slug, active: true },
      });
      if (bySlug) return bySlug;
    }
  }

  // 3. Atalho de pré-visualização por cookie (?tenant=slug), enquanto o
  // subdomínio/domínio próprio não está configurado.
  const override = (await cookies()).get("tenant_override")?.value;
  if (override) {
    const byOverride = await prisma.tenant.findFirst({
      where: { slug: override, active: true },
    });
    if (byOverride) return byOverride;
  }

  // 4. Fallback: tenant mãe
  return prisma.tenant.findFirst({
    where: { type: "MOTHER" },
    orderBy: { createdAt: "asc" },
  });
}

// Converte "#0f766e" em "15 118 110" (canais RGB) para usar com opacidade
// no Tailwind: rgb(var(--brand-rgb) / <alpha>).
function hexToRgbChannels(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `${r} ${g} ${b}`;
}

// Injeta as cores do tenant como CSS variables no layout.
export function tenantThemeStyle(tenant: {
  brandColor: string;
  brandFgColor: string;
}) {
  return {
    "--brand-color": tenant.brandColor,
    "--brand-fg": tenant.brandFgColor,
    "--brand-rgb": hexToRgbChannels(tenant.brandColor),
    "--brand-fg-rgb": hexToRgbChannels(tenant.brandFgColor),
  } as React.CSSProperties;
}
