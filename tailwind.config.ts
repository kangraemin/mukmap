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
        cream: '#FAF7F0',
        'cream-warm': '#FFFCF6',
        border: '#EDE8DC',
        primary: {
          DEFAULT: 'oklch(0.68 0.18 28)',
          light: '#FFF6E8',
          deep: 'oklch(0.45 0.14 35)',
        },
        ink: {
          DEFAULT: '#0F0D08',
          body: '#221E15',
          section: '#3A3526',
          secondary: '#5A5142',
          tertiary: '#7A6F58',
          muted: '#9A8E78',
        },
        surface: { DEFAULT: '#fff', low: '#F1EDE3', high: '#E8E2D6' },
        success: '#34C759',
        error: '#b31b25',
      },
      keyframes: {
        slideInR: {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'slide-in-r': 'slideInR 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fadeIn 0.18s ease',
      },
    },
  },
  plugins: [],
};
export default config;
