import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import MiniMap from '@/components/MiniMap'

export const revalidate = 3600

interface PageProps {
  params: { id: string }
}

async function getRestaurant(id: number) {
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      *,
      videos (
        id,
        video_id,
        channel_id,
        title,
        thumbnail_url,
        rating,
        summary,
        is_ad,
        timestamp_seconds,
        published_at,
        channels (
          id,
          name,
          thumbnail_url
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = Number(params.id)
  if (isNaN(id)) return { title: '맛집 | MukMap' }

  const restaurant = await getRestaurant(id)
  if (!restaurant) return { title: '맛집 | MukMap' }

  const firstVideo = restaurant.videos?.[0] as Record<string, unknown> | undefined
  const summary = (firstVideo?.summary as string) || `${restaurant.category} 맛집`
  const thumbnail = (firstVideo?.thumbnail_url as string) || undefined

  return {
    title: `${restaurant.name} - ${restaurant.region || ''} 맛집 | MukMap`,
    description: summary,
    openGraph: {
      title: `${restaurant.name} - ${restaurant.region || ''} 맛집 | MukMap`,
      description: summary,
      images: thumbnail ? [{ url: thumbnail }] : [],
    },
  }
}

const ratingStyle: Record<string, string> = {
  '강력추천': 'bg-success text-white',
  '추천': 'bg-warning text-secondary',
  '보통': 'bg-gray-200 text-gray-600',
  '비추': 'bg-error text-white',
  '언급없음': 'bg-gray-100 text-gray-400',
}

export default async function RestaurantPage({ params }: PageProps) {
  const id = Number(params.id)
  if (isNaN(id)) notFound()

  const restaurant = await getRestaurant(id)
  if (!restaurant) notFound()

  const videos = (restaurant.videos || []) as Array<{
    id: number
    video_id: string
    channel_id: string
    title: string | null
    thumbnail_url: string | null
    rating: string | null
    summary: string | null
    is_ad: boolean
    timestamp_seconds: number | null
    published_at: string | null
    channels: { id: string; name: string; thumbnail_url: string | null } | null
  }>

  const naverMapUrl = `https://map.naver.com/v5/search/${encodeURIComponent(restaurant.name + ' ' + (restaurant.address || ''))}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    address: restaurant.address || undefined,
    geo: restaurant.lat && restaurant.lng ? {
      '@type': 'GeoCoordinates',
      latitude: restaurant.lat,
      longitude: restaurant.lng,
    } : undefined,
    servesCuisine: restaurant.category,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-white px-4 shadow-sm">
          <Link href="/" className="text-gray-400 hover:text-secondary">
            ← 뒤로
          </Link>
          <Link href="/" className="text-lg font-bold text-primary">MukMap</Link>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-6">
          {/* Restaurant info */}
          <h1 className="text-2xl font-bold text-secondary">{restaurant.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {restaurant.category} · {restaurant.address || '주소 없음'}
          </p>

          {/* Mini map */}
          {restaurant.lat && restaurant.lng && (
            <div className="mt-4">
              <MiniMap markers={[{ lat: restaurant.lat, lng: restaurant.lng, name: restaurant.name }]} height="300px" />
            </div>
          )}

          {/* Naver map link */}
          <a
            href={naverMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            네이버 지도에서 보기
          </a>

          {/* Youtuber reviews */}
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-bold text-secondary">방문 유튜버</h2>
            <div className="space-y-3">
              {videos.map((v) => (
                <div key={v.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    {v.channels?.thumbnail_url && (
                      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full">
                        <Image
                          src={v.channels.thumbnail_url}
                          alt={v.channels.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/youtuber/${v.channel_id}`}
                          className="text-sm font-semibold text-secondary hover:underline"
                        >
                          {v.channels?.name || ''}
                        </Link>
                        {v.rating && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ratingStyle[v.rating] || ''}`}>
                            {v.rating}
                          </span>
                        )}
                        {v.is_ad && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">광고</span>
                        )}
                      </div>
                      {v.summary && (
                        <p className="mt-1 text-sm text-gray-600">&ldquo;{v.summary}&rdquo;</p>
                      )}
                      {v.title && (
                        <p className="mt-1 text-xs text-gray-400">{v.title}</p>
                      )}
                    </div>
                  </div>

                  {/* YouTube embed */}
                  <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg">
                    <iframe
                      src={`https://www.youtube.com/embed/${v.video_id}${v.timestamp_seconds ? `?start=${v.timestamp_seconds}` : ''}`}
                      title={v.title || ''}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="h-full w-full"
                    />
                  </div>
                </div>
              ))}

              {videos.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">등록된 영상이 없습니다</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
