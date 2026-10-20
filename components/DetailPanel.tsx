/* eslint-disable @next/next/no-img-element -- 토스 앱과 같이 쓰는 컴포넌트라 next/image를 쓰지 않는다 */
import type { RestaurantWithVideos, VideoDetail } from '@/lib/types'
import { areaOf, leadVideo, placeUrl, sceneUrl, thumbOf, type VisitVideo } from '@/lib/format'
import { KO_LABELS, type DetailLabels } from '@/lib/i18n'
import { ChannelFace } from './ChannelFace'
import { RecBadge } from './RecBadge'
import { ShareIcon } from './ShareIcon'

interface DetailPanelProps {
  restaurant: RestaurantWithVideos
  onClose?: () => void
  closeLabel?: string
  /** 유튜버 이름을 누르면 갈 주소. 없으면 링크 없이 이름만 */
  channelHref?: (slug: string) => string
  /** 페이지(가게 상세)에서는 이름을 h1로 */
  asPage?: boolean
  /** 버튼 줄 아래에 둘 광고 자리. 토스 앱만 넘긴다 */
  adSlot?: React.ReactNode
  /** 공유 버튼을 누르면 부른다. 토스 앱만 넘긴다 */
  onShare?: () => void
  /** 외국어 페이지가 넘기는 화면 글자. 없으면 한국어 */
  labels?: DetailLabels
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
    </svg>
  )
}

// 영상에서 안 말한 칸은 아예 그리지 않는다
const has = (v: string | null | undefined): v is string => Boolean(v && v.trim())
const listOf = (xs: string[] | undefined, n: number) => (xs || []).filter(has).slice(0, n)

const CHIPS: (keyof VideoDetail)[] = ['price', 'wait', 'parking', 'reserve', 'hours', 'solo_ok']
// 맛·양·간은 좋았던/아쉬운 점과 겹쳐서 보여주지 않는다(사용자 지시 2026-10-20)
const MORE: (keyof VideoDetail)[] = ['vibe', 'service', 'revisit', 'good_for', 'value']

function NameOf({ v, channelHref }: { v: VisitVideo; channelHref?: (slug: string) => string }) {
  return channelHref && v.channel_slug
    ? <a href={channelHref(v.channel_slug)} className="font-bold text-ink underline-offset-2 hover:underline">{v.channel_name}</a>
    : <span className="font-bold text-ink">{v.channel_name}</span>
}

/** 유튜버 한 명이 영상에서 말한 평. 늘 같은 순서: 총평 → 메뉴 → 좋았던/아쉬운 점 → 방문 정보 → 나머지 */
function Review({ v, d, channelHref, Sub, t }: { v: VisitVideo; d: VideoDetail; channelHref?: (slug: string) => string; Sub: 'h2' | 'h3'; t: DetailLabels }) {
  const dishes = (d.dishes || []).filter((x) => has(x.name))
  const best = dishes.findIndex((x) => x.best)
  const ordered = (best > 0 ? [dishes[best], ...dishes.filter((_, i) => i !== best)] : dishes).slice(0, 3)
  const pros = listOf(d.pros, 3)
  const cons = listOf(d.cons, 3)
  const chips = CHIPS.filter((k) => has(d[k] as string)).map((k) => [k, t.chips[k]!] as const)
  const more = MORE.filter((k) => has(d[k] as string)).map((k) => [k, t.more[k]!] as const)
  const [before, after] = t.reviewOf('')
  const tips = listOf(d.tips, 3)
  const face = { id: v.channel_id, name: v.channel_name, thumbnail: v.channel_thumbnail }
  return (
    <section data-testid="detail-review" className="border-b border-line py-6 last:border-0">
      <Sub className="flex items-center gap-2 text-body">
        <ChannelFace face={face} size={28} />
        <span>{before && <span className="text-ink">{before}</span>}<NameOf v={v} channelHref={channelHref} /><span className="text-ink">{after}</span></span>
        <RecBadge rec={d.recommend} label={d.recommend_label} />
      </Sub>
      {has(d.verdict) && <p className="mt-3 text-lead font-bold leading-[1.45] text-ink">“{d.verdict}”</p>}

      {ordered.length > 0 && (
        <ul className="mt-5 space-y-3">
          {ordered.map((x) => (
            <li key={x.name} className="text-body">
              <span className="flex items-center gap-1.5">
                <span className="font-bold text-ink">{x.name}</span>
                {x.best && <span className="rounded-[6px] bg-[#FFEBEE] px-1.5 py-0.5 text-[12px] font-bold leading-4 text-[#D22030]">{t.best}</span>}
              </span>
              {has(x.comment) && <span className="mt-0.5 block text-sub">{x.comment}</span>}
            </li>
          ))}
        </ul>
      )}

      {(pros.length > 0 || cons.length > 0) && (
        <div className={`mt-5 grid gap-2 ${pros.length && cons.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {[[t.pros, pros], [t.cons, cons]].map(([label, xs]) =>
            (xs as string[]).length ? (
              <div key={label as string} className="rounded-card bg-well px-3 py-3">
                <p className="text-meta font-bold text-sub">{label as string}</p>
                <ul className="mt-1.5 space-y-1 text-meta text-ink">
                  {(xs as string[]).map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}

      {chips.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2">
          {chips.map(([k, label]) => (
            <div key={k} className="rounded-card border border-line px-3 py-2.5">
              <dt className="text-meta text-sub">{label}</dt>
              <dd className="mt-0.5 text-body font-semibold text-ink">{d[k] as string}</dd>
            </div>
          ))}
        </dl>
      )}

      {(more.length > 0 || tips.length > 0) && (
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
          {more.map(([k, label]) => (
            <div key={k} className="contents">
              <dt className="text-sub">{label}</dt>
              <dd className="text-ink">{d[k] as string}</dd>
            </div>
          ))}
          {tips.length > 0 && (
            <>
              <dt className="text-sub">{t.tips}</dt>
              <dd className="text-ink"><ul className="space-y-1">{tips.map((t) => <li key={t}>{t}</li>)}</ul></dd>
            </>
          )}
        </dl>
      )}
    </section>
  )
}

export default function DetailPanel({ restaurant: r, onClose, closeLabel = '닫기', channelHref, asPage, adSlot, onShare, labels: t = KO_LABELS }: DetailPanelProps) {
  const lead = leadVideo(r)
  // 상세 요약이 있는 영상만, 최근 순(videos는 이미 최근 순)
  const reviewed = r.videos.filter((v) => v.detail && (has(v.detail.verdict) || (v.detail.dishes || []).length))
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
          <img src={thumbOf(lead)} alt={t.scene(r.name)} className="h-full w-full object-cover" />
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
              {t.watch}
            </a>
          )}
          <a
            href={placeUrl(r)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 flex-1 items-center justify-center rounded-card border border-line text-body font-bold text-ink"
          >
            {t.directions}
          </a>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label={t.share}
              data-testid="share-detail"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-card border border-line text-ink"
            >
              <ShareIcon />
            </button>
          )}
        </div>
        {adSlot}

        {reviewed.length > 0 ? (
          <div className="mt-2">
            {reviewed.map((v) => <Review key={v.id} v={v} d={v.detail!} channelHref={channelHref} Sub={Sub} t={t} />)}
          </div>
        ) : (
          <>
            <Sub className="mt-8 text-lead font-bold text-ink">{t.visitors(new Set(r.videos.map((v) => v.channel_id)).size)}</Sub>
            <ol className="mt-1">
              {r.videos.map((v) => {
                const face = { id: v.channel_id, name: v.channel_name, thumbnail: v.channel_thumbnail }
                return (
                  <li key={v.id} className="border-b border-line py-4 last:border-0">
                    <div className="flex items-center gap-2 text-body">
                      <ChannelFace face={face} size={28} />
                      <NameOf v={v} channelHref={channelHref} />
                    </div>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
                      {v.menu && (<><dt className="text-sub">{t.ate}</dt><dd className="text-ink">{v.menu}</dd></>)}
                      {v.price && (<><dt className="text-sub">{t.videoPrice}</dt><dd className="text-ink">{v.price}</dd></>)}
                      {(v.why || v.summary) && (<><dt className="text-sub">{t.visitSummary}</dt><dd className="text-ink">{v.why || v.summary}</dd></>)}
                    </dl>
                  </li>
                )
              })}
            </ol>
          </>
        )}

        <Sub className="mt-6 text-lead font-bold text-ink">{t.videos(r.videos.length)}</Sub>
        <ul data-testid="detail-videos" className="mt-2">
          {r.videos.map((v) => (
            <li key={v.id}>
              <a href={sceneUrl(v)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5">
                <span className="h-[54px] w-[96px] flex-shrink-0 overflow-hidden rounded-[8px] bg-well">
                  <img src={`https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-body text-ink">{v.title || t.watch}</span>
                  <span className="mt-0.5 block text-meta text-sub">{[v.channel_name, v.published_at && t.date(v.published_at)].filter(Boolean).join(' · ')}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
