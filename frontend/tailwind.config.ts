import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        skybrand: "#3BA8FF",
        mintbrand: "#B8F5C8",
        ink: "#172033"
      },
      boxShadow: {
        soft: "0 18px 48px rgba(23, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

