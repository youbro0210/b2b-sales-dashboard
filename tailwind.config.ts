import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 은하수산 브랜드 컬러 (바다 블루)
        brand: {
          DEFAULT: "#0184CA",
          light: "#38bdf8",
          dark: "#0166A3",
          deep: "#0A2540",
        },
      },
    },
  },
  plugins: [],
};
export default config;
