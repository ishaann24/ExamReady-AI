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
        background: "#12141A",
        surface: "#F2F1EC",
        muted: "#8B93A6",
        accent: "#D98E3F",
        "status-strong": "#3D6B54",
        "status-weak": "#8A3B3B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
