import { NextResponse, type NextRequest } from "next/server";

// Atalho de PRÉ-VISUALIZAÇÃO de filhas sem DNS: ao abrir uma URL com
// ?tenant=<slug>, guardamos o slug num cookie e o `resolveTenant` passa a
// carregar essa filha. Útil enquanto o subdomínio/domínio próprio não está
// configurado. Passar ?tenant= (vazio) volta para o tenant mãe.
//
// Observação: isto só troca qual tenant é exibido/autenticado no login. Os
// dados após o login continuam escopados ao tenant do usuário logado (sessão).
export function middleware(req: NextRequest) {
  const tenantParam = req.nextUrl.searchParams.get("tenant");
  if (tenantParam === null) return NextResponse.next();

  const res = NextResponse.next();
  const slug = tenantParam.trim().toLowerCase();
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
  // Roda nas páginas; ignora assets estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
