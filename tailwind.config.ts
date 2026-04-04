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
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: '#FF6B35', dark: '#E05A2B', light: '#FFF0E8' },
        secondary: '#1A1A2E',
        gray: { 50: '#FAFAFA', 100: '#F5F5F7', 200: '#E5E5EA', 400: '#8E8E93', 600: '#636366' },
        success: '#34C759',
        warning: '#FFCC02',
        error: '#FF3B30',
        marker: { 1: '#FF6B35', 2: '#2196F3', 3: '#4CAF50', 4: '#9C27B0', 5: '#FF9800' },
      },
    },
  },
  plugins: [],
};
export default config;
