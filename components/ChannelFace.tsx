/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */
import { faceSrc } from '@/lib/pins'

interface Face {
  id: string
  name: string
  thumbnail: string | null
}

export function ChannelFace({ face, size = 24, ring = false, eager = false }: { face: Face; size?: number; ring?: boolean; eager?: boolean }) {
  return face.thumbnail ? (
    <img
      src={faceSrc(face.thumbnail)}
      alt={face.name}
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      className={`flex-shrink-0 rounded-full bg-well object-cover ${ring ? 'ring-2 ring-paper' : ''}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-label={face.name}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-well font-bold text-sub ${ring ? 'ring-2 ring-paper' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {face.name[0]}
    </span>
  )
}

/** 여러 유튜버가 다녀갔으면 얼굴을 겹쳐 보여주고 이름을 붙인다 */
export function VisitorLine({ faces, size = 20, others = (name, n) => `${name} 외 ${n}명` }: { faces: Face[]; size?: number; others?: (name: string, n: number) => string }) {
  if (!faces.length) return null
  const label = faces.length === 1 ? faces[0].name : others(faces[0].name, faces.length - 1)
  return (
    // 이름은 한 줄로 두고 넘치면 말줄임한다(좁은 카드에서 '히/밥'처럼 세로로 쪼개졌다)
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex flex-shrink-0">
        {faces.slice(0, 3).map((f, i) => (
          <span key={f.id} style={{ marginLeft: i ? -size * 0.3 : 0, zIndex: 3 - i }} className="relative">
            <ChannelFace face={f} size={size} ring={faces.length > 1} />
          </span>
        ))}
      </span>
      <span data-testid="visitor-name" className={`min-w-0 truncate whitespace-nowrap ${size >= 24 ? 'text-body font-bold text-ink' : 'text-meta text-sub'}`}>{label}</span>
    </span>
  )
}
