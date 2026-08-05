import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// Limites por segurança básica. Imagens de capa/banner ficam bem abaixo disso.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// POST /api/upload — recebe um arquivo de imagem (campo "file") e devolve a URL
// pública no Vercel Blob. Só admin pode subir. Se o Blob não estiver configurado
// (BLOB_READ_WRITE_TOKEN ausente), devolve 501 e a UI cai no campo de URL.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Upload de imagens ainda não configurado. Ative o Vercel Blob no projeto ou cole a URL da imagem.",
      },
      { status: 501 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem acima de 8 MB." }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato inválido. Use PNG, JPG, WebP ou SVG." },
      { status: 400 }
    );
  }

  // Prefixo por tenant + slot para organização; nome aleatório evita colisão.
  const slot = String(form.get("slot") ?? "img").replace(/[^a-z0-9_-]/gi, "");
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const key = `${user.tenantId}/${slot}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  try {
    const blob = await put(key, file, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[upload] falha", e);
    return NextResponse.json(
      { error: "Falha ao subir a imagem. Tente novamente ou cole a URL." },
      { status: 500 }
    );
  }
}
