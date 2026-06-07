import type { Config } from "tailwindcss";

const config: Config = {
  content: {
    relative: true,
    files: ["./app/**/*.{ts,tsx}"],
  },
  theme: {
    extend: {
      colors: {
        page: "#F5F6F7",
        panel: "#FFFFFF",
        tableHead: "#F2F3F5",
        textMain: "#0B0B0F",
        textSubtle: "#5F6368",
        textWeak: "#9CA3AF",
        line: "#E5E7EB",
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
