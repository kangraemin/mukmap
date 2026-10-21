import type { Config } from "tailwindcss";

// 색은 app/globals.css의 CSS 변수(라이트/다크)로 정의하고 여기서는 이름만 붙인다.
// caption(자막 띠 노랑)과 play(영상 버튼 빨강)는 각자 한 곳에만 쓴다.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // 버튼 모양 같은 공용 클래스 문자열(lib/tossLink.ts TOSS_BUTTON)
    "./lib/**/*.{ts,tsx}",
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
        sheetIn: { from: { transform: 'translateY(32px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        sheetOut: { from: { transform: 'none', opacity: '1' }, to: { transform: 'translateY(32px)', opacity: '0' } },
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        slideOut: { from: { transform: 'none' }, to: { transform: 'translateX(100%)' } },
        riseIn: { from: { transform: 'translateY(6%)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        riseOut: { from: { transform: 'none', opacity: '1' }, to: { transform: 'translateY(6%)', opacity: '0' } },
        dropIn: { from: { transform: 'translateY(-6px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        fadeOut: { from: { opacity: '1' }, to: { opacity: '0', visibility: 'hidden' } },
        introBar: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(300%)' } },
        captionIn: {
          from: { transform: 'translateY(6px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'caption-in': 'captionIn 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'sheet-in': 'sheetIn 0.32s cubic-bezier(0.2, 0.9, 0.25, 1) both',
        'sheet-out': 'sheetOut 0.2s cubic-bezier(0.4, 0, 1, 1) both',
        'slide-in': 'slideIn 0.34s cubic-bezier(0.2, 0.9, 0.25, 1) both',
        'slide-out': 'slideOut 0.24s cubic-bezier(0.4, 0, 1, 1) both',
        'rise-in': 'riseIn 0.3s cubic-bezier(0.2, 0.9, 0.25, 1) both',
        'rise-out': 'riseOut 0.2s cubic-bezier(0.4, 0, 1, 1) both',
        'drop-in': 'dropIn 0.18s ease-out both',
        'fade-out': 'fadeOut 0.4s ease-in both',
      },
    },
  },
  plugins: [],
};
export default config;
