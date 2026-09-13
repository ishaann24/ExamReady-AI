import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E3A8A",
        accent: "#F59E0B",
        surface: "#FFFFFF",
        "surface-muted": "#F8FAFC",
        text: "#0F172A",
        "text-muted": "#64748B",
        "status-strong": "#16A34A",
        "status-needs-revision": "#F59E0B",
        "status-weak": "#DC2626",
        "status-not-assessed": "#94A3B8",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
