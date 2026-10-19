/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // og 이미지가 런타임에 읽는 자막 서체. 파일 추적에 안 잡혀 함수 번들에 직접 넣는다
    outputFileTracingIncludes: { '/**/opengraph-image': ['./assets/BlackHanSans-Regular.ttf'] },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
      },
    ],
  },
};

export default nextConfig;
