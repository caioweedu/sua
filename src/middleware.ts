import { NextResponse, type NextRequest } from "next/server";

// Acesso/impersonação de filha via ?tenant=<slug>. Guardamos o slug num cookie
// e REDIRECIONAMOS para a mesma URL sem o parâmetro — assim a requisição
// seguinte já carrega o cookie e o app resolve a filha na hora (um clique).
// ?tenant= (vazio) limpa o cookie e volta para o tenant mãe.
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  if (!url.searchParams.has("tenant")) return NextResponse.next();

  const slug = (url.searchParams.get("tenant") ?? "").trim().toLowerCase();
  const dest = new URL(url);
  dest.searchParams.delete("tenant");

  const res = NextResponse.redirect(dest);
  if (slug) {
    res.cookies.set("tenant_override", slug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 1 dia
    });
  } else {
    res.cookies.delete("tenant_override");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
