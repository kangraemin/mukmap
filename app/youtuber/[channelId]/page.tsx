import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import MiniMap from '@/components/MiniMap'
import YoutuberRestaurantList from './RestaurantList'

export const revalidate = 3600

interface PageProps {
  params: { channelId: string }
}

async function getChannelData(channelId: string) {
  const { data: channel, error } = await supabase
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single()

  if (error || !channel) return null

  const { data: videos } = await supabase
    .from('videos')
    .select(`
      id,
      video_id,
      title,
      thumbnail_url,
      rating,
      summary,
      timestamp_seconds,
      published_at,
      restaurant_id,
      restaurants (
        id,
        name,
        address,
        lat,
        lng,
        category,
        region
      )
    `)
    .eq('channel_id', channelId)
    .not('restaurant_id', 'is', null)
    .order('published_at', { ascending: false })

  return { channel, videos: videos || [] }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getChannelData(params.channelId)
  if (!data) return { title: '유튜버 | MukMap' }

  const restaurantCount = new Set(data.videos.map((v) => v.restaurant_id)).size

  return {
    title: `${data.channel.name} 맛집 리스트 | MukMap`,
    description: `${data.channel.name}이(가) 방문한 맛집 ${restaurantCount}곳`,
    openGraph: {
      title: `${data.channel.name} 맛집 리스트 | MukMap`,
      description: `${data.channel.name}이(가) 방문한 맛집 ${restaurantCount}곳`,
      images: data.channel.thumbnail_url ? [{ url: data.channel.thumbnail_url }] : [],
    },
  }
}

export default async function YoutuberPage({ params }: PageProps) {
  const data = await getChannelData(params.channelId)
  if (!data) notFound()

  const { channel, videos } = data

  // Deduplicate restaurants
  const restaurantMap = new Map<number, {
    id: number
    name: string
    address: string | null
    lat: number | null
    lng: number | null
    category: string
    region: string | null
    video: {
      video_id: string
      title: string | null
      thumbnail_url: string | null
      rating: string | null
      summary: string | null
      timestamp_seconds: number | null
    }
  }>()

  for (const v of videos) {
    const r = v.restaurants as unknown as {
      id: number; name: string; address: string | null
      lat: number | null; lng: number | null; category: string; region: string | null
    } | null
    if (!r) continue
    if (!restaurantMap.has(r.id)) {
      restaurantMap.set(r.id, {
        ...r,
        video: {
          video_id: v.video_id,
          title: v.title,
          thumbnail_url: v.thumbnail_url,
          rating: v.rating,
          summary: v.summary,
          timestamp_seconds: v.timestamp_seconds,
        },
      })
    }
  }

  const restaurants = Array.from(restaurantMap.values())
  const mapMarkers = restaurants
    .filter((r) => r.lat && r.lng)
    .map((r) => ({ lat: r.lat!, lng: r.lng!, name: r.name }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-white px-4 shadow-sm">
        <Link href="/" className="text-gray-400 hover:text-secondary">
          ← 뒤로
        </Link>
        <Link href="/" className="text-lg font-bold text-primary">MukMap</Link>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Channel info */}
        <div className="flex items-center gap-4">
          {channel.thumbnail_url && (
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full">
              <Image
                src={channel.thumbnail_url}
                alt={channel.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-secondary">{channel.name}</h1>
            <p className="text-sm text-gray-600">맛집 {restaurants.length}곳</p>
          </div>
        </div>

        {/* Mini map */}
        {mapMarkers.length > 0 && (
          <div className="mt-6">
            <MiniMap markers={mapMarkers} height="300px" />
          </div>
        )}

        {/* Restaurant list (client component for infinite scroll) */}
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-secondary">방문 맛집</h2>
          <YoutuberRestaurantList restaurants={restaurants} />
        </section>
      </main>
    </div>
  )
}
