/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */
import React from 'react'
import type { RestaurantWithVideos } from '@/lib/types'
import { areaOf, leadVideo, thumbOf, visitorsOf } from '@/lib/format'
import { VisitorLine } from './ChannelFace'

interface CardProps {
  restaurant: RestaurantWithVideos
  href?: string
  onClick?: () => void
  selected?: boolean
  /** 유튜버 칩으로 거른 목록이면 그 유튜버(slug 또는 id)를 맨 앞에 보여 준다 */
  firstChannel?: string
}

function Shell({ href, onClick, className, children }: Omit<CardProps, 'restaurant' | 'selected' | 'firstChannel'> & {
  className: string
  children: React.ReactNode
}) {
  return href ? (
    <a href={href} onClick={onClick ? (e) => { e.preventDefault(); onClick() } : undefined} className={className}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={`${className} text-left`}>
      {children}
    </button>
  )
}

/** 목록 한 줄. 시트·사이드바에서 여러 개를 훑어볼 때 쓴다 */
function RestaurantCard({ restaurant: r, href, onClick, selected }: CardProps) {
  const lead = leadVideo(r)
  const line = lead?.menu || lead?.summary
  return (
    <Shell
      href={href}
      onClick={onClick}
      className={`flex w-full min-h-[88px] gap-3 border-b border-line px-1 py-3.5 transition-colors ${
        selected ? 'bg-well' : 'active:bg-well'
      }`}
    >
      <span className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-card bg-well">
        {lead && (
          <img src={thumbOf(lead)} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-lead font-bold text-ink">{r.name}</span>
          <span className="flex-shrink-0 text-meta text-sub">{r.category}</span>
        </span>
        <span className="truncate text-meta text-sub">{areaOf(r)}</span>
        {line && (
          <span className="line-clamp-1 text-body text-ink">{line}</span>
        )}
        <span className="mt-0.5"><VisitorLine faces={visitorsOf(r)} size={18} /></span>
      </span>
    </Shell>
  )
}

export default React.memo(RestaurantCard)

/** 큰 카드: 영상 장면 위에 자막을 얹는다. 유튜버·지역 페이지 목록에 쓴다 */
export function SceneCard({ restaurant: r, href, onClick, firstChannel }: CardProps) {
  const lead = leadVideo(r)
  const faces = visitorsOf(r)
  const at = faces.findIndex((f) => f.slug === firstChannel || f.id === firstChannel)
  if (at > 0) faces.unshift(...faces.splice(at, 1))
  return (
    <Shell href={href} onClick={onClick} className="group block w-full">
      <span className="relative block aspect-video overflow-hidden rounded-card bg-well">
        {lead && (
          <img src={thumbOf(lead)} alt={`${r.name} 영상 장면`} loading="lazy" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="mt-3 flex items-baseline gap-2">
        <span className="truncate text-lead font-bold text-ink group-hover:underline">{r.name}</span>
        <span className="flex-shrink-0 text-meta text-sub">{r.category}</span>
      </span>
      <span className="mt-0.5 block text-meta text-sub">{r.address || areaOf(r)}</span>
      {(lead?.menu || lead?.price) && (
        <span className="mt-1.5 block text-body text-ink">
          {lead?.menu}
          {lead?.price && <span className="text-sub"> / {lead.price}</span>}
        </span>
      )}
      <span className="mt-2 block"><VisitorLine faces={faces} /></span>
    </Shell>
  )
}
