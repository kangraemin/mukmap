import type { Metadata, Viewport } from 'next'
import { Black_Han_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { SITE_NAME, SITE_URL, jsonLdScript, siteJsonLd } from '@/lib/seo'

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
      </head>
      <body className="antialiased">
        {children}
        {jsonLdScript(siteJsonLd())}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}')`}
        </Script>
      </body>
    </html>
  )
}
