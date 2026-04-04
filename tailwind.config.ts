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
        surface: { DEFAULT: '#fff4f3', low: '#ffedeb', lowest: '#ffffff', high: '#ffdad7', dim: '#ffc7c2' },
        primary: { DEFAULT: '#a63300', container: '#ff7949', dim: '#922c00', light: '#fff4f3' },
        'on-surface': '#4e211e',
        'on-surface-variant': '#834c48',
        'on-primary': '#ffefeb',
        secondary: { DEFAULT: '#a03834', container: '#ffc3be' },
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
