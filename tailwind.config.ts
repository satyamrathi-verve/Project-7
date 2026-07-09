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
        // Soft, printed-paper elevation — no hard edges or glow.
        card: "0 1px 2px rgba(17, 24, 39, 0.04), 0 6px 16px -6px rgba(17, 24, 39, 0.07)",
        "card-hover": "0 2px 4px rgba(17, 24, 39, 0.05), 0 14px 28px -8px rgba(17, 24, 39, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
