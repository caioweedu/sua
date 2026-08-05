import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// Upload simples via servidor: o cliente já envia a imagem OTIMIZADA (redim.
// no navegador), então o arquivo é pequeno e cabe folgado no limite de corpo
// das funções. Sem client-upload/webhook — só um put() direto no Blob.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (após otimização isso sobra)
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Upload não configurado: falta BLOB_READ_WRITE_TOKEN no projeto (e um redeploy). Cole a URL da imagem enquanto isso.",
      },
      { status: 400 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Use PNG, JPG, WebP ou SVG." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Imagem muito grande mesmo após otimização. Tente uma menor." },
      { status: 400 }
    );
  }

  const slot = String(form.get("slot") ?? "img").replace(/[^a-z0-9_-]/gi, "");
  const ext = (file.type.split("/")[1] ?? "png").replace("+xml", "");
  const key = `${user.tenantId}/${slot}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  try {
    const blob = await put(key, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[upload] falha", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao subir a imagem." },
      { status: 500 }
    );
  }
}
