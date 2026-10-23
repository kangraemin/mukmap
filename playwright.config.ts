import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // 전체 262개를 dev 서버 하나로 이어 돌리면 첫 컴파일·DB 응답이 가끔 30초를 넘겨 매번 다른 1~3개가 떨어진다(따로 돌리면 통과).
  // 한 번만 다시 돌린다. 진짜 깨진 테스트는 두 번 다 실패하고, 다시 돌려 통과한 건 flaky로 따로 찍힌다
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
    // 토스 미니앱 번들(toss/). 토스 웹뷰와 같은 화면을 띄워 본다
    {
      command: 'npm --prefix toss run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
