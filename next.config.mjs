/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vídeos e imagens são hospedados externamente (o admin só cola o link),
  // então permitimos imagens remotas de qualquer host aqui no MVP.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
