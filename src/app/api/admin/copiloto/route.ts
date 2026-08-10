import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import {
  gerarProposta,
  MAX_PDF_BYTES,
  MAX_TEXTO,
} from "@/lib/copiloto";

export const runtime = "nodejs";
// Geração pode levar alguns segundos; damos folga à função.
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Copiloto não configurado: defina ANTHROPIC_API_KEY no projeto e refaça o deploy.",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const texto = String(form.get("texto") ?? "").slice(0, MAX_TEXTO);
  const numQuestoes = Number(form.get("numQuestoes") ?? 6) || 6;

  let pdf: { base64: string; mediaType: string } | undefined;
  const file = form.get("pdf");
  if (file instanceof File && file.size > 0) {
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "O arquivo precisa ser um PDF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "PDF muito grande. Use um arquivo de até 12 MB." },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    pdf = { base64: buf.toString("base64"), mediaType: "application/pdf" };
  }

  if (!texto.trim() && !pdf) {
    return NextResponse.json(
      { error: "Cole um texto ou envie um PDF para gerar o curso." },
      { status: 400 }
    );
  }

  try {
    const proposta = await gerarProposta({
      tenantName: user.tenant.name,
      texto,
      pdf,
      numQuestoes,
    });
    return NextResponse.json({ proposta });
  } catch (e) {
    console.error("[copiloto] falha ao gerar", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Falha ao gerar o curso. Tente novamente.",
      },
      { status: 500 }
    );
  }
}
