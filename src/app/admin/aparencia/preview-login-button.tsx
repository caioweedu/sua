"use client";

// Botão "Pré-visualizar" da tela de login. Lê os valores ATUAIS do formulário
// (mesmo sem salvar) e abre /login?preview=1&ov=1&... numa nova aba, para o
// admin ver o resultado antes de salvar. Se não gostar, é só não salvar.

// Campos do formulário que compõem a tela de login.
const LOGIN_FIELDS = [
  "loginBgUrl",
  "loginEyebrow",
  "loginTitle",
  "loginSubtitle",
  "loginTextColor",
  "loginEyebrowColor",
  "loginTitleColor",
  "loginSubtitleColor",
  "loginEyebrowBold",
  "loginTitleBold",
  "loginSubtitleBold",
  "loginEyebrowItalic",
  "loginTitleItalic",
  "loginSubtitleItalic",
  "loginHideText",
];

export default function PreviewLoginButton() {
  function openPreview(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const params = new URLSearchParams({ preview: "1", ov: "1" });
    if (form) {
      const fd = new FormData(form);
      for (const key of LOGIN_FIELDS) {
        const v = fd.get(key);
        // Checkboxes só aparecem no FormData quando marcados — mantemos a chave
        // presente (o /login trata "presença" como verdadeiro).
        if (v != null) params.set(key, String(v));
      }
    }
    window.open(`/login?${params.toString()}`, "_blank", "noopener");
  }

  return (
    <button type="button" onClick={openPreview} className="btn-outline px-2 py-1 text-xs">
      👁️ Pré-visualizar ↗
    </button>
  );
}
