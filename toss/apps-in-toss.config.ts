// 토스 미니앱(앱인토스) 빌드 설정. `npm run build`로 mukmap.ait를 만든다.
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'mukmap-kr',
  brand: { primaryColor: '#1B1D1F' },
  permissions: [],
  navigationBar: { withBackButton: true, withHomeButton: true },
  webView: { bounces: false },
  webBundleDir: 'dist',
});
