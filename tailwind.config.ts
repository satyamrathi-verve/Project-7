import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Verve Advisory brand blue
        brand: {
          DEFAULT: "#3B5998",
          dark: "#2d4373",
          light: "#4a6aa8",
        },
        // Layered neutral surfaces — the "architectural" background system.
        canvas: "#F7F8FA",
        surface: "#FFFFFF",
        elevated: "#FCFCFD",
        sidebar: "#F2F4F7",
        section: "#FAFBFC",
        hairline: "#E5E7EB",
        // Text ramp.
        ink: {
          DEFAULT: "#111827",
          secondary: "#4B5563",
          muted: "#6B7280",
        },
        // Semantic financial states — profit / loss / pending / info.
        success: { DEFAULT: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
        warning: { DEFAULT: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
        danger: { DEFAULT: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
        info: { DEFAULT: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE" },
      },
      boxShadow: {
        // Soft, printed-paper elevation — no hard edges or glow. One layered
        // shadow used everywhere a card sits at rest, and one for hover/lift.
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(15, 23, 42, 0.05), 0 18px 50px rgba(15, 23, 42, 0.06)",
        "card-hover": "0 2px 4px rgba(15, 23, 42, 0.05), 0 10px 24px rgba(15, 23, 42, 0.08), 0 24px 60px rgba(15, 23, 42, 0.10)",
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
      },
      animation: {
        "draw-line": "drawLine 1s ease-premium forwards",
        "fade-in-up": "fadeInUp 300ms ease-premium both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
