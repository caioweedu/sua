/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vídeos e imagens são hospedados externamente (o admin só cola o link),
  // então permitimos imagens remotas de qualquer host aqui no MVP.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Headers de segurança básicos (gate de pré-lançamento). Não incluímos CSP
  // por ora para não quebrar os embeds de vídeo (YouTube/Vimeo/Panda) e os
  // estilos inline — fica como passo seguinte, testado com cuidado.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Bloqueia recursos que o app não usa; não restringe autoplay/
          // fullscreen/picture-in-picture (necessários aos players de vídeo).
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
