"use client";

export default function PrintButton() {
  return (
    <button className="btn-brand" onClick={() => window.print()}>
      🖨️ Imprimir / Salvar PDF
    </button>
  );
}
