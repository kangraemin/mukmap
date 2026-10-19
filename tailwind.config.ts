import type { Config } from "tailwindcss";

// 색은 app/globals.css의 CSS 변수(라이트/다크)로 정의하고 여기서는 이름만 붙인다.
// caption(자막 띠 노랑)과 play(영상 버튼 빨강)는 각자 한 곳에만 쓴다.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: v('paper'),
        well: v('well'),
        line: v('line'),
        sub: v('sub'),
        caption: { DEFAULT: '#FFE14D', ink: '#1B1D1F' },
        // 흰 글씨 대비 4.5:1 이상
        play: '#D42638',
        // 아래 옛 이름은 관리자 화면만 쓴다. 관리자는 흰 바탕 고정이라 다크 모드를 따라가지 않는 고정색을 둔다
        ink: {
          DEFAULT: v('ink'),
          body: '#1B1D1F',
          section: '#1B1D1F',
          secondary: '#6B7684',
          tertiary: '#6B7684',
          muted: '#6B7684',
        },
        cream: { DEFAULT: '#FFFFFF', warm: '#FFFFFF' },
        border: v('line'),
        surface: { DEFAULT: '#FFFFFF', low: '#F2F4F6', high: '#E5E8EB' },
        primary: { DEFAULT: '#1B1D1F', light: '#F2F4F6', deep: '#1B1D1F', dark: '#1B1D1F' },
        secondary: '#1B1D1F',
        success: '#1A9E5C',
        error: '#D22030',
        warning: '#FFE14D',
      },
      fontFamily: {
        caption: ['var(--font-caption)', 'Pretendard Variable', 'sans-serif'],
      },
      fontSize: {
        // 13 / 15 / 17 / 22 / 28 다섯 단계만 쓴다
        meta: ['13px', { lineHeight: '18px' }],
        body: ['15px', { lineHeight: '22px' }],
        lead: ['17px', { lineHeight: '24px' }],
        title: ['22px', { lineHeight: '29px' }],
        display: ['28px', { lineHeight: '35px' }],
      },
      borderRadius: {
        card: '12px',
        sheet: '20px',
      },
      keyframes: {
        captionIn: {
          from: { transform: 'translateY(6px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'caption-in': 'captionIn 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
export default config;
