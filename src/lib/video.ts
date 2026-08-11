// Converte um link de vídeo (YouTube, Vimeo, Panda, etc.) numa URL de embed.
// O admin pode colar o link normal OU o código de incorporação (<iframe ...>);
// aqui normalizamos para o endereço correto usado dentro do iframe do player.
export function toEmbedUrl(input: string): string | null {
  if (!input) return null;

  // Se colaram o código de incorporação inteiro (ex.: "<iframe src="..."></iframe>"),
  // extraímos apenas o endereço de dentro do src. É o erro mais comum no Panda.
  const url = extractIframeSrc(input) ?? input.trim();

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      // formato /embed/ID já pronto
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === "player.vimeo.com") return url;

    // Panda Video, Vturb e outros players que já entregam URL de embed:
    // devolvemos o link como está para ser usado num iframe.
    return url;
  } catch {
    return null;
  }
}

// Extrai o valor do atributo src de um trecho de HTML com <iframe>.
// Retorna null quando o texto não é um código de incorporação.
function extractIframeSrc(input: string): string | null {
  if (!input.includes("<iframe")) return null;
  const match = input.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  return match ? match[1].trim() : null;
}
