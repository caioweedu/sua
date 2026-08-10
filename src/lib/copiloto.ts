import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ---------------------------------------------------------------------------
// COPILOTO DE IA PARA CRIAÇÃO (Fase 5)
// ---------------------------------------------------------------------------
// A partir de um texto colado ou de um PDF/manual, a IA propõe a ESTRUTURA de
// um curso (produto ▸ módulos ▸ aulas com resumo) e um quiz com gabarito. A
// proposta é sempre EDITÁVEL pelo gestor antes de virar conteúdo — aqui só
// geramos e validamos o rascunho; a persistência fica na action `copiloto.ts`.
//
// Reaproveita a mesma integração Anthropic do professor virtual (ANTHROPIC_API_KEY).

// Limites defensivos de entrada.
export const MAX_TEXTO = 60_000; // ~ um manual médio colado
export const MAX_PDF_BYTES = 12 * 1024 * 1024; // 12 MB

// Forma da proposta que a IA devolve (e que o preview edita).
export type PropostaAula = { titulo: string; resumo: string };
export type PropostaModulo = { titulo: string; aulas: PropostaAula[] };
export type PropostaQuestao = {
  enunciado: string;
  alternativas: string[];
  correta: number; // índice (0-based) da alternativa correta
};
export type PropostaCurso = {
  titulo: string;
  descricao: string;
  modulos: PropostaModulo[];
  quiz: PropostaQuestao[];
};

// Validação/saneamento da saída do modelo. Coeragem defensiva: descartamos
// aulas sem título, questões com menos de 2 alternativas ou índice inválido.
const aulaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  resumo: z.string().trim().max(2000).default(""),
});
const moduloSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  aulas: z.array(aulaSchema).default([]),
});
export const questaoSchema = z
  .object({
    enunciado: z.string().trim().min(1).max(1000),
    alternativas: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
    correta: z.number().int().min(0),
  })
  .refine((q) => q.correta < q.alternativas.length, {
    message: "índice da correta fora do intervalo",
  });

// Lista de questões (usada pela geração avulsa "gerar questões").
export const questoesSchema = z.array(questaoSchema);

export const propostaSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).default(""),
  modulos: z.array(moduloSchema).default([]),
  quiz: z.array(questaoSchema).default([]),
});

// JSON Schema da ferramenta que o modelo é OBRIGADO a chamar (saída estruturada).
const TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    titulo: { type: "string", description: "Título do produto/curso." },
    descricao: {
      type: "string",
      description: "Descrição curta do produto (1–3 frases).",
    },
    modulos: {
      type: "array",
      description: "Módulos do curso, na ordem em que devem aparecer.",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          aulas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                resumo: {
                  type: "string",
                  description:
                    "Resumo da aula em 1–3 frases, com base no material.",
                },
              },
              required: ["titulo", "resumo"],
            },
          },
        },
        required: ["titulo", "aulas"],
      },
    },
    quiz: {
      type: "array",
      description: "Questões de múltipla escolha para avaliação final.",
      items: {
        type: "object",
        properties: {
          enunciado: { type: "string" },
          alternativas: {
            type: "array",
            items: { type: "string" },
            description: "De 2 a 5 alternativas.",
          },
          correta: {
            type: "integer",
            description:
              "Índice (começando em 0) da alternativa correta em 'alternativas'.",
          },
        },
        required: ["enunciado", "alternativas", "correta"],
      },
    },
  },
  required: ["titulo", "descricao", "modulos", "quiz"],
};

function systemPrompt(tenantName: string, numQuestoes: number) {
  return `Você é um designer instrucional que ajuda a ${tenantName} a transformar materiais em cursos de treinamento corporativo.

A partir do material fornecido pelo gestor, proponha a ESTRUTURA de um curso:
- Um título de produto claro e uma descrição curta (1–3 frases).
- Módulos em ordem lógica de aprendizado; cada módulo com suas aulas.
- Para cada aula, um resumo de 1–3 frases FIEL ao material (não invente fatos que não estão no material).
- Um quiz de avaliação com ${numQuestoes} questões de múltipla escolha (2 a 5 alternativas cada), com exatamente UMA alternativa correta por questão, cobrindo os pontos mais importantes.

Regras:
- Escreva tudo em português do Brasil.
- Baseie-se SOMENTE no material fornecido. Se o material for curto, proponha uma estrutura enxuta em vez de inventar conteúdo.
- Prefira de 2 a 6 módulos e de 2 a 6 aulas por módulo, ajustando ao tamanho do material.
- Devolva o resultado EXCLUSIVAMENTE chamando a ferramenta "propor_curso". Não escreva texto fora da ferramenta.`;
}

export type GerarInput = {
  tenantName: string;
  texto?: string;
  pdf?: { base64: string; mediaType: string };
  numQuestoes?: number;
};

// Gera a proposta chamando o Claude com tool use forçado e valida a saída.
export async function gerarProposta(input: GerarInput): Promise<PropostaCurso> {
  const numQuestoes = Math.min(Math.max(input.numQuestoes ?? 6, 3), 15);

  // Blocos de conteúdo enviados ao modelo: PDF (nativo) e/ou texto colado.
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.pdf) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: input.pdf.base64,
      },
    });
  }
  const texto = (input.texto ?? "").slice(0, MAX_TEXTO).trim();
  if (texto) {
    content.push({ type: "text", text: `Material do curso:\n\n${texto}` });
  }
  if (content.length === 0) {
    throw new Error("Envie um texto ou um PDF para gerar o curso.");
  }
  content.push({
    type: "text",
    text: "Com base no material acima, chame a ferramenta propor_curso com a estrutura do curso e o quiz.",
  });

  const client = new Anthropic();
  const model = process.env.COPILOTO_MODEL || "claude-opus-5";

  const resp = await client.messages.create({
    model,
    max_tokens: 8000,
    system: systemPrompt(input.tenantName, numQuestoes),
    tools: [
      {
        name: "propor_curso",
        description:
          "Registra a estrutura do curso (produto, módulos, aulas) e o quiz de avaliação.",
        input_schema: TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "propor_curso" },
    messages: [{ role: "user", content }],
  });

  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("A IA não retornou uma estrutura. Tente novamente.");
  }

  const parsed = propostaSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(
      "A estrutura gerada veio incompleta. Ajuste o material e tente novamente."
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// GERAR QUESTÕES AVULSAS (Fase 5 — fatia 2)
// ---------------------------------------------------------------------------
// A partir de um material (texto/PDF) e de um contexto opcional (a prova ou a
// aula alvo), gera SÓ um conjunto de questões de múltipla escolha, para o admin
// revisar e anexar ao banco de uma prova existente.

const TOOL_QUESTOES_SCHEMA = {
  type: "object" as const,
  properties: {
    questoes: {
      type: "array",
      description: "Questões de múltipla escolha geradas a partir do material.",
      items: {
        type: "object",
        properties: {
          enunciado: { type: "string" },
          alternativas: {
            type: "array",
            items: { type: "string" },
            description: "De 2 a 5 alternativas.",
          },
          correta: {
            type: "integer",
            description:
              "Índice (começando em 0) da alternativa correta em 'alternativas'.",
          },
        },
        required: ["enunciado", "alternativas", "correta"],
      },
    },
  },
  required: ["questoes"],
};

export type GerarQuestoesInput = {
  tenantName: string;
  contexto?: string; // ex.: "Prova: X" ou "Aula: Y — descrição"
  texto?: string;
  pdf?: { base64: string; mediaType: string };
  num?: number;
};

export async function gerarQuestoes(
  input: GerarQuestoesInput
): Promise<PropostaQuestao[]> {
  const num = Math.min(Math.max(input.num ?? 5, 1), 20);

  const content: Anthropic.ContentBlockParam[] = [];
  if (input.pdf) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: input.pdf.base64,
      },
    });
  }
  const texto = (input.texto ?? "").slice(0, MAX_TEXTO).trim();
  if (texto) {
    content.push({ type: "text", text: `Material:\n\n${texto}` });
  }
  if (content.length === 0) {
    throw new Error("Envie um texto ou um PDF para gerar as questões.");
  }
  content.push({
    type: "text",
    text: "Com base no material acima, chame a ferramenta propor_questoes.",
  });

  const system = `Você é um designer instrucional da ${input.tenantName}. Gere ${num} questões de múltipla escolha (2 a 5 alternativas cada, exatamente UMA correta) que avaliem a compreensão do material fornecido.${
    input.contexto ? `\n\nContexto: ${input.contexto}` : ""
  }

Regras:
- Escreva em português do Brasil.
- Baseie-se SOMENTE no material fornecido; não invente fatos.
- Cubra os pontos mais importantes, evitando questões repetidas.
- Devolva o resultado EXCLUSIVAMENTE chamando a ferramenta "propor_questoes".`;

  const client = new Anthropic();
  const model = process.env.COPILOTO_MODEL || "claude-opus-5";

  const resp = await client.messages.create({
    model,
    max_tokens: 6000,
    system,
    tools: [
      {
        name: "propor_questoes",
        description: "Registra as questões geradas a partir do material.",
        input_schema: TOOL_QUESTOES_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: "propor_questoes" },
    messages: [{ role: "user", content }],
  });

  const toolUse = resp.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("A IA não retornou questões. Tente novamente.");
  }

  const input_ = (toolUse.input ?? {}) as { questoes?: unknown };
  const parsed = questoesSchema.safeParse(input_.questoes);
  if (!parsed.success || parsed.data.length === 0) {
    throw new Error("Nenhuma questão válida foi gerada. Tente outro material.");
  }
  return parsed.data;
}
