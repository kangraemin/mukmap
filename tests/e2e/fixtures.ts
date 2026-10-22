import { test as base, expect } from '@playwright/test'

// 네이버 지도 키에는 localhost:5174(토스 앱 개발 서버)가 등록돼 있지 않아 지도 인증이 401이고 핀이 하나도 안 뜬다.
// 인증 요청만 등록된 3000 주소인 것처럼 바꿔 묻는다. 인증 요청은 http라 정규식으로 잡는다.
// route는 5174를 처음 열 때만 건다. 웹(3000) 테스트에 context.route가 걸려 있으면 Mobile Safari에서 navigator.share 대체가 먹지 않는다
export const test = base.extend({
  page: async ({ page, context }, use) => {
    const goto = page.goto.bind(page)
    let routed = false
    page.goto = async (url, opts) => {
      if (!routed && url.includes('localhost:5174')) {
        routed = true
        await context.route(/\/\/oapi\.map\.naver\.com\/v3\/auth/, (route) => {
          const u = new URL(route.request().url())
          u.searchParams.set('url', 'http://localhost:3000/')
          return route.continue({ url: u.toString(), headers: { ...route.request().headers(), referer: 'http://localhost:3000/' } })
        })
      }
      return goto(url, opts)
    }
    await use(page)
  },
})
export { expect }
