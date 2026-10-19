/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */

interface Face {
  id: string
  name: string
  thumbnail: string | null
}

export function ChannelFace({ face, size = 24, ring = false }: { face: Face; size?: number; ring?: boolean }) {
  return face.thumbnail ? (
    <img
      src={face.thumbnail}
      alt={face.name}
      width={size}
      height={size}
      loading="lazy"
      className={`flex-shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-paper' : ''}`}
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
export function VisitorLine({ faces, size = 20 }: { faces: Face[]; size?: number }) {
  if (!faces.length) return null
  const label = faces.length === 1 ? faces[0].name : `${faces[0].name} 외 ${faces.length - 1}명`
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex">
        {faces.slice(0, 3).map((f, i) => (
          <span key={f.id} style={{ marginLeft: i ? -size * 0.3 : 0, zIndex: 3 - i }} className="relative">
            <ChannelFace face={f} size={size} ring={faces.length > 1} />
          </span>
        ))}
      </span>
      <span className="text-meta text-sub">{label}</span>
    </span>
  )
}
