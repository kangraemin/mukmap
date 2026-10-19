// 토스 미니앱 번들. 화면 컴포넌트는 웹(../components)과 같은 것을 쓰고, 데이터는 mukmap.kr API를 부른다.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  // 네이버 지도 키는 웹과 같은 공개 키(.env.local)를 쓴다
  const env = loadEnv(mode, root, 'NEXT_PUBLIC_');
  return {
    base: './',
    plugins: [react()],
    resolve: {
      alias: { '@': root },
      dedupe: ['react', 'react-dom'],
    },
    define: {
      'process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID': JSON.stringify(env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || ''),
    },
    build: { outDir: 'dist', target: 'es2019' },
  };
});
