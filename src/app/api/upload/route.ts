import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// Upload de imagens (capas/banners) via Vercel Blob no modelo *client upload*:
// o arquivo vai direto do navegador para o Blob, e esta rota apenas assina o
// token. Isso evita o limite de ~4,5 MB de corpo das funções serverless.
export async function POST(request: Request): Promise<NextResponse> {
  // Sem token configurado: devolve aviso amigável (a UI cai no campo de URL).
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Upload de imagens ainda não configurado. Conecte um Blob Store do Vercel ao projeto (variável BLOB_READ_WRITE_TOKEN) ou cole a URL da imagem.",
      },
      { status: 501 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/svg+xml",
        ],
        addRandomSuffix: true,
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        tokenPayload: JSON.stringify({ tenantId: user.tenantId }),
      }),
      // Sem pós-processamento: a URL já volta para o cliente pelo fluxo padrão.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[upload] falha", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha no upload." },
      { status: 400 }
    );
  }
}
