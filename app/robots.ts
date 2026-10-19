import type { MetadataRoute } from 'next'
import { abs } from '@/lib/seo'

// 검색봇·AI 검색봇은 모두 허용한다. 관리자와 API만 막는다
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: abs('/sitemap.xml'),
    host: abs('/'),
  }
}
