'use client'

import { useEffect, useState } from 'react'
import { ChannelFace } from './ChannelFace'

const SEEN_KEY = 'mukmap:intro'
const MIN_MS = 900
const MAX_MS = 4000
// 가게 목록이 아직 안 왔으면 MAX_MS가 지나도 빈 지도를 보이지 않고 이때까지 기다린다
const HARD_MS = 12000

interface IntroChannel {
  id: string
  name: string
  thumbnail_url: string | null
}

/** 처음 들어왔을 때 지도가 준비될 때까지 덮어 두는 화면. 세션당 한 번만 */
export default function Intro({ ready, loaded, channels, brand = '먹맵', tagline = '유튜버가 실제로 가서 먹은 집' }: { ready: boolean; loaded: boolean; channels: IntroChannel[]; brand?: string; tagline?: string }) {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>('show')
  const [minDone, setMinDone] = useState(false)
  const [maxDone, setMaxDone] = useState(false)

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; sessionStorage.setItem(SEEN_KEY, '1') } catch {}
    if (seen) { setPhase('gone'); return }
    const a = setTimeout(() => setMinDone(true), MIN_MS)
    const b = setTimeout(() => setMaxDone(true), MAX_MS)
    const c = setTimeout(() => setPhase((p) => (p === 'show' ? 'leaving' : p)), HARD_MS)
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c) }
  }, [])

  useEffect(() => {
    if ((ready && minDone) || (maxDone && loaded)) setPhase((p) => (p === 'show' ? 'leaving' : p))
  }, [ready, minDone, maxDone, loaded])

  useEffect(() => {
    if (phase !== 'leaving') return
    const t = setTimeout(() => setPhase('gone'), 400)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'gone') return null
  const faces = channels.filter((c) => c.thumbnail_url).slice(0, 5)

  return (
    <div
      data-testid="intro"
      aria-hidden="true"
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-paper ${phase === 'leaving' ? 'pointer-events-none animate-fade-out' : ''}`}
    >
      <p className="animate-rise-in font-caption text-[56px] leading-none text-ink">
        <span className="caption-band rounded-[10px] px-3">{brand}</span>
      </p>
      <p className="mt-5 animate-rise-in text-lead font-bold text-ink [animation-delay:120ms] [animation-fill-mode:both]">
        {tagline}
      </p>
      {faces.length > 0 && (
        <div className="mt-7 flex -space-x-2 animate-rise-in [animation-delay:240ms] [animation-fill-mode:both]">
          {faces.map((c) => (
            <span key={c.id} className="rounded-full ring-2 ring-paper">
              <ChannelFace face={{ id: c.id, name: c.name, thumbnail: c.thumbnail_url }} size={40} eager />
            </span>
          ))}
        </div>
      )}
      <span className="mt-10 h-1 w-24 overflow-hidden rounded-full bg-well">
        <span className="block h-full w-1/3 animate-[introBar_1s_ease-in-out_infinite] rounded-full bg-ink" />
      </span>
    </div>
  )
}
