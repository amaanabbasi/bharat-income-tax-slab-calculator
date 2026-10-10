import type { Config } from "tailwindcss";

/** Payroll colours resolve to CSS variables (see src/app/payroll/payroll.css) so light and dark share one palette. */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/payroll/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: token("--bg"),
        surface: token("--surface"),
        "surface-2": token("--surface-2"),
        line: token("--line"),
        ink: token("--ink"),
        muted: token("--muted"),
        accent: token("--accent"),
        "accent-ink": token("--accent-ink"),
        "accent-text": token("--accent-text"),
        "accent-bright": token("--accent-bright"),
        "glow-cool": token("--glow-cool"),
        good: token("--good"),
        warn: token("--warn"),
        bad: token("--bad"),
      },
      fontFamily: {
        body: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        composer: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 28px -12px rgb(0 0 0 / 0.12)",
        paper: "0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -18px rgb(0 0 0 / 0.18)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(-6%, -4%, 0) scale(1)" },
          "50%": { transform: "translate3d(6%, 4%, 0) scale(1.08)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        drift: "drift 18s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        rise: "rise 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in": "slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
