// Converte um link de vídeo (YouTube, Vimeo, etc.) numa URL de embed.
// O admin só cola o link normal; aqui geramos o iframe correto.
export function toEmbedUrl(url: string): string | null {
  if (!url) return null;
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
