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
        surface: { DEFAULT: '#ffffff', low: '#f8f8fa', lowest: '#ffffff', high: '#eeeeef', dim: '#e0e0e2' },
        primary: { DEFAULT: '#FF6B35', container: '#FF8C5A', dim: '#E05A2B', light: '#FFF5F0' },
        'on-surface': '#1a1a2e',
        'on-surface-variant': '#6b7280',
        'on-primary': '#ffffff',
        secondary: { DEFAULT: '#1a1a2e', container: '#f3f4f6' },
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
