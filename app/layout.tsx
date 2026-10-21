import type { Metadata, Viewport } from 'next'
import { Black_Han_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { SITE_NAME, SITE_URL, jsonLdScript, siteJsonLd } from '@/lib/seo'
import TrackClicks from '@/components/TrackClicks'

// 자막 인용에만 쓰는 굵은 서체. 한글 글자가 많아 미리 받지 않고 쓰는 글자만 받는다
const captionFont = Black_Han_Sans({
  weight: '400',
  subsets: ['latin'],
  preload: false,
  display: 'swap',
  variable: '--font-caption',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `유튜버 맛집 지도 | ${SITE_NAME}`, template: `%s` },
  description: '먹방 유튜버가 영상에서 실제로 찾아간 식당을 지도에서 찾고, 먹은 메뉴와 가격, 영상 속 한마디를 확인하세요.',
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'ko_KR',
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    types: { 'application/rss+xml': `${SITE_URL}/feed.xml` },
  },
  formatDetection: { telephone: false },
  icons: { apple: '/apple-touch-icon.png' },
  verification: {
    google: '4Is-0ncEK0T6CX29cU1ufNxnqUPkgTiOromSm43Vwhg',
    other: {
      'naver-site-verification': 'b9e3cee388babb56b7ecfe470a82410959cac502',
      'msvalidate.01': '57132096C71EC15E786D6702170C9A2C',
    },
  },
}

const GA_ID = 'G-KGKJWJ5NKV'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // iOS가 입력칸을 누를 때 화면을 확대한 채로 두지 않게 한다
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#17181C' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={captionFont.variable}>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 애드센스 자동 광고. 웹에만 넣는다(토스 앱 번들은 토스 배너를 쓴다) */}
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4785237655148075" crossOrigin="anonymous" />
        {/* GA4는 화면을 그리기 전에 깔아 둔다. 첫 화면 이벤트(app_open)가 gtag 도착 전에 나가도 줄에 쌓인다(lib/analytics.ts).
            운영 주소에서만 켜고, ?ga_debug=1 이면 DebugView로, 기기에 mk_internal을 두면 내부 트래픽으로 보낸다 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}if(location.hostname==='${new URL(SITE_URL).hostname}'){gtag('js',new Date());var c={};if(/[?&]ga_debug=1/.test(location.search))c.debug_mode=true;try{if(localStorage.getItem('mk_internal'))c.traffic_type='internal'}catch(e){}gtag('config','${GA_ID}',c)}`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
        {jsonLdScript(siteJsonLd())}
        <TrackClicks />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      </body>
    </html>
  )
}
