import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // A cor da marca vem em canais RGB (definidos em runtime por tenant),
        // então opacidade funciona: bg-brand/10, ring-brand/30, etc.
        brand: {
          DEFAULT: "rgb(var(--brand-rgb, 37 99 235) / <alpha-value>)",
          fg: "rgb(var(--brand-fg-rgb, 255 255 255) / <alpha-value>)",
        },
        ink: "#0f172a",
        surface: "#0b1120",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
