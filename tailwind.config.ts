import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Latin-first stack with a Bangla fallback in the SAME declaration.
        // The browser picks per-glyph: Latin characters resolve to Inter,
        // and Bengali characters — which Inter has no glyph for — fall
        // through to BengaliCustom (Bornomala) automatically. That means a
        // mixed line like "Desi Couple — চটি গল্প" renders both scripts in
        // the intended face with no per-string class juggling.
        latin: [
          "var(--font-latin)",
          "var(--font-bengali)",
          "system-ui",
          "sans-serif",
        ],
        // Bangla-only surfaces (article prose, nav, form labels) stay on the
        // custom face explicitly so they never touch the Latin stack.
        bengali: ["var(--font-bengali)", "sans-serif"],
        sans: [
          "var(--font-latin)",
          "var(--font-bengali)",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "var(--color-surface)",
          alt: "var(--color-surface-alt)",
          hover: "var(--color-surface-hover)",
        },
        border: "var(--color-border)",
        fg: {
          DEFAULT: "var(--color-fg)",
          muted: "var(--color-fg-muted)",
          subtle: "var(--color-fg-subtle)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
        },
      },
      maxWidth: {
        article: "680px",
        wide: "1200px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
