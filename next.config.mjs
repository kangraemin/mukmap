/** @type {import('next').NextConfig} */
const nextConfig = {
  // 일시 오류 재시도(lib/retry.ts)가 기다릴 시간을 둔다
  staticPageGenerationTimeout: 180,
  experimental: {
    // 빌드 워커가 10개 동시에 Supabase를 부르면 statement timeout으로 배포가 깨졌다(10/23). 동시에 그리는 워커 수를 줄인다
    cpus: 3,
    // og 이미지가 런타임에 읽는 자막 서체. 파일 추적에 안 잡혀 함수 번들에 직접 넣는다
    outputFileTracingIncludes: {
      '/**/opengraph-image': ['./assets/BlackHanSans-Regular.ttf'],
      // 블로그 글 파일은 fs로 읽어 추적에 안 잡힌다. 매시간 다시 그릴 때도 읽을 수 있게 넣는다
      '/**': ['./content/blog/*.md'],
    },
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
