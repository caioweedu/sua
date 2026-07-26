import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cores base do tema; cada tenant (mãe/filha) sobrescreve via CSS variables
        // definidas em runtime a partir do branding salvo no banco.
        brand: {
          DEFAULT: "var(--brand-color, #2563eb)",
          fg: "var(--brand-fg, #ffffff)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
