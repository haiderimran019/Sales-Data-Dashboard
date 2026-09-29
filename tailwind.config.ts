import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        surface: "hsl(var(--surface))",
        ink: "hsl(var(--ink))",
        muted: "hsl(var(--muted))",
        line: "hsl(var(--line))",
        brand: "hsl(var(--brand))",
        positive: "hsl(var(--positive))",
        negative: "hsl(var(--negative))"
      },
      boxShadow: {
        card: "0 12px 30px rgb(15 23 42 / 0.06)"
      }
    }
  },
  plugins: []
} satisfies Config;
