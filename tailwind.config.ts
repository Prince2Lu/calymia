import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A5F",
          dark: "#1E3A5F",
          medium: "#2E75B6",
          accent: "#27AE60",
        },
      },
      borderRadius: {
        lg: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;

