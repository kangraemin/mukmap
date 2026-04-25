import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "먹맵 - 유튜버 맛집 지도",
  description: "유튜버들이 추천한 맛집을 지도에서 한눈에",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
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
      </body>
    </html>
  );
}
