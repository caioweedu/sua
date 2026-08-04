// Utilitários de CSV sem dependências externas. Usados na importação em massa
// de conteúdo (vitrines/produtos/módulos/aulas) e provas via planilha.

// Faz o parse de um texto CSV em uma matriz de células. Suporta campos entre
// aspas (com vírgulas e quebras de linha internas) e aspas escapadas ("").
export function parseCsv(input: string): string[][] {
  // Remove BOM que o Excel/Sheets costuma adicionar.
  const text = input.replace(/^﻿/, "");
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
    } else if (c === ",") {
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

// Escapa uma célula para CSV.
function esc(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Monta um texto CSV a partir de uma matriz. Prefixa BOM para o Excel abrir
// com acentuação correta.
export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
