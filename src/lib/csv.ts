// Utilitários de CSV sem dependências externas. Usados na importação em massa
// de conteúdo (vitrines/produtos/módulos/aulas) e provas via planilha.
//
// Os modelos são gerados com ponto-e-vírgula (";"), que é o separador padrão do
// Excel em português — assim a planilha abre com cada campo na sua coluna. Na
// leitura detectamos o separador automaticamente, aceitando ";" ou ",".

// Detecta o separador (";" ou ",") olhando a primeira linha de dados, contando
// apenas ocorrências fora de aspas. Ponto-e-vírgula tem prioridade por ser o
// padrão do Excel PT-BR; cai para vírgula quando ele não aparece.
function detectDelimiter(text: string): "," | ";" {
  let semicolons = 0;
  let commas = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes) {
      if (c === ";") semicolons++;
      else if (c === ",") commas++;
      else if (c === "\n") break; // só a primeira linha
    }
  }
  return semicolons >= commas && semicolons > 0 ? ";" : ",";
}

// Faz o parse de um texto CSV em uma matriz de células. Suporta campos entre
// aspas (com o separador e quebras de linha internas) e aspas escapadas ("").
export function parseCsv(input: string, delimiter?: "," | ";"): string[][] {
  // Remove BOM que o Excel/Sheets costuma adicionar.
  const text = input.replace(/^﻿/, "");
  const sep = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignora; o \n seguinte fecha a linha
    } else {
      field += c;
    }
  }
  // Última célula/linha (arquivos sem \n final).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Descarta linhas totalmente vazias.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Escapa uma célula para CSV, considerando o separador em uso.
function esc(v: string, sep: string): string {
  if (v.includes('"') || v.includes(sep) || /[\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// Monta um texto CSV a partir de uma matriz. Usa ponto-e-vírgula por padrão
// (separador do Excel PT-BR) e prefixa BOM para o Excel abrir com acentuação
// correta e cada campo em sua própria coluna.
export function toCsv(rows: string[][], delimiter: "," | ";" = ";"): string {
  return (
    "﻿" +
    rows.map((r) => r.map((c) => esc(c, delimiter)).join(delimiter)).join("\r\n") +
    "\r\n"
  );
}
