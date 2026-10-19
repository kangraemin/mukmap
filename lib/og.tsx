// 공유 미리보기 이미지(1200×630). 사이트의 자막 띠를 그대로 쓴다.
import { readFile } from 'fs/promises'
import path from 'path'
import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

let font: Promise<Buffer> | null = null
function captionFont() {
  font ??= readFile(path.join(process.cwd(), 'assets/BlackHanSans-Regular.ttf'))
  return font
}

export async function ogImage({ line, sub }: { line: string; sub: string }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#1B1D1F', padding: '72px 80px' }}>
        <div style={{ display: 'flex', fontSize: 40, color: '#FFFFFF' }}>먹맵</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', background: '#FFE14D', color: '#1B1D1F', fontSize: 92, lineHeight: 1.2, padding: '6px 22px 2px' }}>{line}</div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 40, color: '#C9CDD2' }}>{sub}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: 'caption', data: await captionFont(), weight: 400, style: 'normal' }] },
  )
}
