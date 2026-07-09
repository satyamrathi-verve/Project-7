import type { Config } from "tailwindcss";

const withAlpha = (varName: string) => `rgb(var(${varName}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Verve Advisory brand blue — sourced from CSS vars so it can shift
        // slightly brighter in dark mode to keep contrast against dark surfaces.
        brand: {
          DEFAULT: withAlpha("--color-brand"),
          dark: withAlpha("--color-brand-dark"),
          light: withAlpha("--color-brand-light"),
        },
        // Layered neutral surfaces — the "architectural" background system.
        // Values live in CSS vars (globals.css) and flip with the `.dark` class.
        canvas: withAlpha("--color-canvas"),
        surface: withAlpha("--color-surface"),
        elevated: withAlpha("--color-elevated"),
        sidebar: withAlpha("--color-sidebar"),
        section: withAlpha("--color-section"),
        hairline: withAlpha("--color-hairline"),
        // Text ramp.
        ink: {
          DEFAULT: withAlpha("--color-ink"),
          secondary: withAlpha("--color-ink-secondary"),
          muted: withAlpha("--color-ink-muted"),
        },
        // Semantic financial states — profit / loss / pending / info.
        success: { DEFAULT: withAlpha("--color-success"), bg: withAlpha("--color-success-bg"), border: withAlpha("--color-success-border") },
        warning: { DEFAULT: withAlpha("--color-warning"), bg: withAlpha("--color-warning-bg"), border: withAlpha("--color-warning-border") },
        danger: { DEFAULT: withAlpha("--color-danger"), bg: withAlpha("--color-danger-bg"), border: withAlpha("--color-danger-border") },
        info: { DEFAULT: withAlpha("--color-info"), bg: withAlpha("--color-info-bg"), border: withAlpha("--color-info-border") },
      },
      boxShadow: {
        // Soft, printed-paper elevation in light mode; a subtler glow in dark
        // mode (set via --shadow-card / --shadow-card-hover in globals.css).
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        glow: "0 0 0 1px rgb(var(--color-brand) / 0.25), 0 0 24px rgb(var(--color-brand) / 0.15)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        drawLine: {
          from: { strokeDashoffset: "1000" },
          to: { strokeDashoffset: "0" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        softGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
      },
      animation: {
        "draw-line": "drawLine 1s ease-premium forwards",
        "fade-in-up": "fadeInUp 300ms ease-premium both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "pop-in": "popIn 220ms ease-premium both",
        "soft-glow": "softGlow 2.4s ease-in-out infinite",
        wiggle: "wiggle 400ms ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
