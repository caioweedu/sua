import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { buildTrilhaContext, professorSystemPrompt } from "@/lib/professor";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado", { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "O professor virtual não está configurado. Defina ANTHROPIC_API_KEY.",
      { status: 503 }
    );
  }

  let body: { trilhaId?: string; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Corpo inválido", { status: 400 });
  }

  const { trilhaId, messages } = body;
  if (!trilhaId || !Array.isArray(messages) || messages.length === 0) {
    return new Response("Parâmetros ausentes", { status: 400 });
  }

  // Contexto sempre resolvido no servidor a partir do tenant do usuário —
  // o cliente nunca injeta o conteúdo da trilha.
  const ctx = await buildTrilhaContext(trilhaId, user.tenantId);
  if (!ctx) return new Response("Trilha não encontrada", { status: 404 });

  // Sanitiza e limita o histórico enviado ao modelo.
  const history = messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return new Response("A última mensagem deve ser do aluno", { status: 400 });
  }

  const client = new Anthropic();
  const model = process.env.PROFESSOR_MODEL || "claude-opus-5";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model,
          max_tokens: 1024,
          // Efeito baixo mantém o chat rápido e econômico para alunos,
          // sem desabilitar o thinking (recomendação da referência do Claude).
          output_config: { effort: "low" },
          system: professorSystemPrompt(ctx.contexto, ctx.tenantName),
          messages: history,
        });

        messageStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await messageStream.finalMessage();
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? `Erro da IA (${err.status}). Tente novamente.`
            : "Erro ao falar com o professor virtual.";
        controller.enqueue(encoder.encode(`\n\n[${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
