/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */
import type { RestaurantWithVideos } from '@/lib/types'
import { areaOf, dateLabel, leadVideo, placeUrl, sceneUrl, thumbOf } from '@/lib/format'
import CaptionQuote from './CaptionQuote'
import { ChannelFace } from './ChannelFace'

interface DetailPanelProps {
  restaurant: RestaurantWithVideos
  onClose?: () => void
  closeLabel?: string
  /** 유튜버 이름을 누르면 갈 주소. 없으면 링크 없이 이름만 */
  channelHref?: (slug: string) => string
  /** 페이지(가게 상세)에서는 이름을 h1로 */
  asPage?: boolean
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
    </svg>
  )
}

export default function DetailPanel({ restaurant: r, onClose, closeLabel = '닫기', channelHref, asPage }: DetailPanelProps) {
  const lead = leadVideo(r)
  const Title = asPage ? 'h1' : 'h2'
  const Sub = asPage ? 'h2' : 'h3'

  return (
    <article className="bg-paper pb-[calc(24px+env(safe-area-inset-bottom))]">
      <div className="flex items-start gap-2 px-4 pb-4 pt-3 sm:px-0">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-ml-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-ink"
          >
            <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="min-w-0 pt-1.5">
          <Title className="text-title font-bold text-ink">{r.name}</Title>
          <p className="mt-1 text-body text-sub">{[r.category, areaOf(r)].filter(Boolean).join(' ')}</p>
          {r.address && <p className="mt-0.5 text-meta text-sub">{r.address}</p>}
        </div>
      </div>

      {lead && (
        <div className="relative aspect-video overflow-hidden bg-well sm:rounded-card">
          <img src={thumbOf(lead)} alt={`${r.name} 영상 장면`} className="h-full w-full object-cover" />
          {lead.quote && (
            <div className="absolute inset-x-4 bottom-4 animate-caption-in">
              <CaptionQuote text={lead.quote} size="lg" className="line-clamp-3" />
            </div>
          )}
        </div>
      )}

      <div className="px-4 pt-4 sm:px-0">
        <div className="flex gap-2">
          {lead && (
            <a
              href={sceneUrl(lead)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-card bg-play text-body font-bold text-white"
            >
              <PlayGlyph />
              영상 보기
            </a>
          )}
          <a
            href={placeUrl(r)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 flex-1 items-center justify-center rounded-card border border-line text-body font-bold text-ink"
          >
            길찾기
          </a>
        </div>

        <Sub className="mt-8 text-lead font-bold text-ink">다녀간 유튜버 {new Set(r.videos.map((v) => v.channel_id)).size}명</Sub>
        <ol className="mt-1">
          {r.videos.map((v) => {
            const face = { id: v.channel_id, name: v.channel_name, thumbnail: v.channel_thumbnail }
            const name = channelHref && v.channel_slug
              ? <a href={channelHref(v.channel_slug)} className="font-bold text-ink underline-offset-2 hover:underline">{v.channel_name}</a>
              : <span className="font-bold text-ink">{v.channel_name}</span>
            return (
              <li key={v.id} className="border-b border-line py-4 last:border-0">
                <div className="flex items-center gap-2 text-body">
                  <ChannelFace face={face} size={28} />
                  {name}
                  {v.published_at && <span className="ml-auto text-meta text-sub">영상 게시 {dateLabel(v.published_at)}</span>}
                </div>
                {v.quote && v !== lead && <CaptionQuote text={v.quote} size="sm" className="mt-3" />}
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
                  {v.menu && (<><dt className="text-sub">먹은 것</dt><dd className="text-ink">{v.menu}</dd></>)}
                  {v.price && (<><dt className="text-sub">영상 속 가격</dt><dd className="text-ink">{v.price}</dd></>)}
                  {(v.why || v.summary) && (<><dt className="text-sub">방문 요약</dt><dd className="text-ink">{v.why || v.summary}</dd></>)}
                </dl>
                <a
                  href={sceneUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-[44px] items-center text-meta text-sub underline underline-offset-2"
                >
                  {v.title || '영상 보기'}
                </a>
              </li>
            )
          })}
        </ol>
        <p className="mt-6 text-meta text-sub">
          메뉴·가격·인용은 영상 자막에서 자동으로 뽑았습니다. 정확한 내용은 원본 영상에서 확인하세요.
        </p>
      </div>
    </article>
  )
}
