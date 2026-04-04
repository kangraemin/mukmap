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
        surface: { DEFAULT: '#fafafa', low: '#f5f5f7', lowest: '#ffffff', high: '#e5e5ea', dim: '#d1d1d6' },
        primary: { DEFAULT: '#FF6B35', container: '#ff8c5a', dim: '#E05A2B', light: '#FFF0E8' },
        'on-surface': '#1a1a2e',
        'on-surface-variant': '#636366',
        'on-primary': '#ffffff',
        secondary: { DEFAULT: '#1a1a2e', container: '#f0f0f2' },
        success: '#34C759',
        warning: '#FFCC02',
        error: '#b31b25',
        marker: { 1: '#FF6B35', 2: '#2196F3', 3: '#4CAF50', 4: '#9C27B0', 5: '#FF9800' },
      },
    },
  },
  plugins: [],
};
export default config;
