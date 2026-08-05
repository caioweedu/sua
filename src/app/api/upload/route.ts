import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// Upload de imagens (capas/banners) via Vercel Blob no modelo *client upload*:
// o arquivo vai direto do navegador para o Blob, e esta rota apenas assina o
// token. Isso evita o limite de ~4,5 MB de corpo das funções serverless.
export async function POST(request: Request): Promise<NextResponse> {
  // Sem token configurado: 4xx (falha rápida; evita retentativas do cliente que
  // parecem "travar"). A UI cai no campo de URL.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Upload não configurado: falta BLOB_READ_WRITE_TOKEN no projeto (e um redeploy para aplicar). Cole a URL da imagem enquanto isso.",
      },
      { status: 400 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      // A autenticação é validada aqui: só roda na geração do token (requisição
      // do navegador, com cookie). O evento de conclusão (webhook do Blob, sem
      // cookie) não passa por aqui e portanto não é bloqueado.
      onBeforeGenerateToken: async () => {
        const user = await getCurrentUser();
        if (!user || !isAdmin(user.role)) {
          throw new Error("Não autorizado a enviar imagens.");
        }
        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/svg+xml",
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
          tokenPayload: JSON.stringify({ tenantId: user.tenantId }),
        };
      },
      // Sem pós-processamento: a URL já volta ao cliente pelo fluxo padrão.
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
