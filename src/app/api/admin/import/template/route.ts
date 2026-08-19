import { NextRequest } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const runtime = "nodejs";

// Modelos de planilha (CSV) para importação em massa. Cada modelo já vem com
// o cabeçalho e algumas linhas de exemplo que o admin substitui.
const TEMPLATES: Record<string, { file: string; rows: string[][] }> = {
  conteudo: {
    file: "modelo-conteudo.csv",
    rows: [
      [
        "Vitrine",
        "Produto",
        "Descrição do Produto",
        "Módulo",
        "Aula",
        "Vídeo (URL)",
        "PDF (URL)",
        "Descrição da Aula",
      ],
      [
        "Time Operacional",
        "Gestão de Resultados",
        "Fundamentos de metas e indicadores.",
        "Introdução",
        "Boas-vindas",
        "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        "",
        "Visão geral da trilha.",
      ],
      [
        "Time Operacional",
        "Gestão de Resultados",
        "",
        "Introdução",
        "Definindo metas SMART",
        "https://vimeo.com/76979871",
        "https://exemplo.com/material.pdf",
        "Como transformar objetivos em metas.",
      ],
      [
        "Time Operacional",
        "Gestão de Resultados",
        "",
        "Indicadores",
        "KPIs essenciais",
        "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        "",
        "",
      ],
    ],
  },
  usuarios: {
    file: "modelo-usuarios.csv",
    rows: [
      ["Nome", "E-mail", "Telefone", "Perfil de acesso", "Equipe", "Senha (opcional)"],
      ["Maria Souza", "maria@empresa.com", "(11) 98888-0001", "Time Operacional", "Comercial", ""],
      ["João Lima", "joao@empresa.com", "(11) 98888-0002", "", "Vendas SP", ""],
    ],
  },
  planejamento: {
    file: "modelo-planejamento.csv",
    rows: [
      ["E-mail do colaborador", "Equipe", "Treinamento (produto)", "Início (AAAA-MM-DD)", "Fim (AAAA-MM-DD)", "Obrigatório (sim/não)"],
      ["maria@empresa.com", "", "Gestão de Resultados", "2026-09-01", "2026-09-30", "sim"],
      ["", "Comercial", "Indicadores e Metas", "", "2026-10-15", "sim"],
    ],
  },
  provas: {
    file: "modelo-provas.csv",
    rows: [
      [
        "Produto",
        "Enunciado",
        "Alternativa Correta",
        "Alternativa 2",
        "Alternativa 3",
        "Alternativa 4",
        "Alternativa 5",
      ],
      [
        "Gestão de Resultados",
        "O que é uma meta SMART?",
        "Específica, mensurável, atingível, relevante e temporal",
        "Uma meta genérica sem prazo",
        "Um indicador financeiro",
        "Um relatório mensal",
        "",
      ],
      [
        "Gestão de Resultados",
        "Para que serve um indicador (KPI)?",
        "Medir o desempenho em relação a um objetivo",
        "Substituir a meta",
        "Aumentar o custo",
        "",
        "",
      ],
    ],
  },
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "conteudo";
  const tpl = TEMPLATES[type];
  if (!tpl) return new Response("Modelo inválido.", { status: 400 });

  const csv = toCsv(tpl.rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tpl.file}"`,
      "Cache-Control": "no-store",
    },
  });
}
