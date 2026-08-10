import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gerarQuestoes, MAX_PDF_BYTES, MAX_TEXTO } from "@/lib/copiloto";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Copiloto não configurado: defina ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const examId = String(form.get("examId") ?? "");
  const texto = String(form.get("texto") ?? "").slice(0, MAX_TEXTO);
  const num = Number(form.get("num") ?? 5) || 5;

  // A prova precisa existir e pertencer ao tenant do admin.
  const exam = examId
    ? await prisma.exam.findFirst({
        where: { id: examId, tenantId: user.tenantId },
        select: { id: true, title: true },
      })
    : null;
  if (!exam) {
    return NextResponse.json({ error: "Prova inválida." }, { status: 404 });
  }

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
      { error: "Cole um texto ou envie um PDF." },
      { status: 400 }
    );
  }

  try {
    const questoes = await gerarQuestoes({
      tenantName: user.tenant.name,
      contexto: `Prova: ${exam.title}`,
      texto,
      pdf,
      num,
    });
    return NextResponse.json({ questoes });
  } catch (e) {
    console.error("[copiloto/questoes] falha", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao gerar questões." },
      { status: 500 }
    );
  }
}
