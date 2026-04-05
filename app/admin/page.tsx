'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Restaurant {
  id: number
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  category: string
  region: string | null
  needs_review: boolean
  is_visible: boolean
  created_at: string
}

interface Video {
  id: number
  video_id: string
  channel_id: string
  title: string | null
  rating: string | null
  summary: string | null
  is_ad: boolean
  timestamp_seconds: number | null
}

type Tab = 'review' | 'restaurants' | 'videos'

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<Tab>('review')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [page, setPage] = useState(0)
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const naverMapRef = useRef<unknown>(null)
  const markerRef = useRef<unknown>(null)

  useEffect(() => {
    const saved = localStorage.getItem('admin_password')
    if (saved) {
      setPassword(saved)
      setAuthenticated(true)
    }
  }, [])

  const getHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-admin-password': password,
  }), [password])

  const handleLogin = () => {
    localStorage.setItem('admin_password', password)
    setAuthenticated(true)
  }

  const fetchReviewRestaurants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/restaurants?sw_lat=-90&sw_lng=-180&ne_lat=90&ne_lng=180&limit=200&include_hidden=true`)
      const data = await res.json()
      setRestaurants((data.restaurants || []).filter((r: Restaurant) => r.needs_review))
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  const fetchAllRestaurants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/restaurants?sw_lat=-90&sw_lng=-180&ne_lat=90&ne_lng=180&limit=200&include_hidden=true`)
      const data = await res.json()
      setAllRestaurants(data.restaurants || [])
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  const fetchVideos = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all restaurants to get their videos
      const res = await fetch(`/api/restaurants?sw_lat=-90&sw_lng=-180&ne_lat=90&ne_lng=180&limit=200`)
      const data = await res.json()
      const allVideos: Video[] = []
      for (const r of data.restaurants || []) {
        for (const v of r.videos || []) {
          allVideos.push(v)
        }
      }
      setVideos(allVideos)
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authenticated) return
    if (tab === 'review') fetchReviewRestaurants()
    else if (tab === 'restaurants') fetchAllRestaurants()
    else if (tab === 'videos') fetchVideos()
  }, [authenticated, tab, fetchReviewRestaurants, fetchAllRestaurants, fetchVideos])

  // Naver Map for coordinate picking
  const initNaverMap = useCallback((lat?: number, lng?: number) => {
    if (!mapRef.current) return
    if (typeof window === 'undefined') return
    const naver = (window as unknown as Record<string, unknown>).naver as {
      maps: {
        Map: new (el: HTMLElement, opts: object) => unknown
        LatLng: new (lat: number, lng: number) => unknown
        Marker: new (opts: object) => unknown
        Event: { addListener: (target: unknown, event: string, handler: (e: { coord: { lat: () => number; lng: () => number } }) => void) => void }
      }
    } | undefined
    if (!naver?.maps) return

    const center = new naver.maps.LatLng(lat || 37.5665, lng || 126.978)
    const map = new naver.maps.Map(mapRef.current, {
      center,
      zoom: 15,
    })
    naverMapRef.current = map

    if (lat && lng) {
      const marker = new naver.maps.Marker({ position: center, map })
      markerRef.current = marker
    }

    naver.maps.Event.addListener(map, 'click', (e) => {
      const coord = { lat: e.coord.lat(), lng: e.coord.lng() }
      setMapCoords(coord)
      if (markerRef.current) {
        (markerRef.current as { setPosition: (p: unknown) => void }).setPosition(
          new naver.maps.LatLng(coord.lat, coord.lng)
        )
      } else {
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(coord.lat, coord.lng),
          map,
        })
        markerRef.current = marker
      }
    })
  }, [])

  const startEdit = (restaurant: Restaurant) => {
    setEditingId(restaurant.id)
    setEditData({
      name: restaurant.name,
      address: restaurant.address || '',
      category: restaurant.category,
      region: restaurant.region || '',
      lat: restaurant.lat,
      lng: restaurant.lng,
    })
    setMapCoords(restaurant.lat && restaurant.lng ? { lat: restaurant.lat, lng: restaurant.lng } : null)
    setTimeout(() => initNaverMap(restaurant.lat || undefined, restaurant.lng || undefined), 100)
  }

  const saveEdit = async (id: number, markReviewed = false) => {
    const updates: Record<string, unknown> = { ...editData, id }
    if (mapCoords) {
      updates.lat = mapCoords.lat
      updates.lng = mapCoords.lng
    }
    if (markReviewed) {
      updates.needs_review = false
    }

    const res = await fetch('/api/admin/restaurants', {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    })

    if (res.ok) {
      setEditingId(null)
      if (tab === 'review') fetchReviewRestaurants()
      else fetchAllRestaurants()
    }
  }

  const deleteRestaurant = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await fetch('/api/admin/restaurants', {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      if (tab === 'review') fetchReviewRestaurants()
      else fetchAllRestaurants()
    }
  }

  const saveVideo = async (id: number, updates: Record<string, unknown>) => {
    const res = await fetch('/api/admin/videos', {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ id, ...updates }),
    })
    if (res.ok) fetchVideos()
  }

  const deleteVideo = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await fetch('/api/admin/videos', {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ id }),
    })
    if (res.ok) fetchVideos()
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
          <h1 className="mb-4 text-xl font-bold text-secondary">Admin 로그인</h1>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="mb-3 w-full rounded border border-gray-200 p-2 text-sm"
          />
          <button
            onClick={handleLogin}
            className="w-full rounded bg-primary py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            로그인
          </button>
        </div>
      </div>
    )
  }

  const PAGE_SIZE = 20

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Naver Map SDK */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`}
      />

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary">MukMap Admin</h1>
          <button
            onClick={() => { localStorage.removeItem('admin_password'); setAuthenticated(false) }}
            className="text-sm text-gray-400 hover:text-error"
          >
            로그아웃
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          {([
            ['review', '보정 필요'],
            ['restaurants', '전체 맛집'],
            ['videos', '전체 영상'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(0) }}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === key
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {key === 'review' && restaurants.length > 0 && (
                <span className="ml-1 rounded-full bg-error px-1.5 text-xs text-white">
                  {restaurants.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-gray-400">로딩중...</p>}

        {/* Review Tab */}
        {tab === 'review' && !loading && (
          <div className="space-y-3">
            {restaurants.length === 0 && (
              <p className="py-8 text-center text-gray-400">보정이 필요한 맛집이 없습니다</p>
            )}
            {restaurants.map((r) => (
              <div key={r.id} className="rounded-lg bg-white p-4 shadow-sm">
                {editingId === r.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={editData.name as string}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="가게명"
                        className="rounded border p-2 text-sm"
                      />
                      <input
                        value={editData.address as string}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        placeholder="주소"
                        className="rounded border p-2 text-sm"
                      />
                      <select
                        value={editData.category as string}
                        onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                        className="rounded border p-2 text-sm"
                      >
                        {['한식','일식','중식','양식','카페/디저트','분식','고기/구이','해산물','기타'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        value={editData.region as string}
                        onChange={(e) => setEditData({ ...editData, region: e.target.value })}
                        placeholder="지역"
                        className="rounded border p-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="any"
                        value={mapCoords?.lat ?? editData.lat as number ?? ''}
                        onChange={(e) => setMapCoords({ lat: Number(e.target.value), lng: mapCoords?.lng ?? 0 })}
                        placeholder="위도 (lat)"
                        className="rounded border p-2 text-sm"
                      />
                      <input
                        type="number"
                        step="any"
                        value={mapCoords?.lng ?? editData.lng as number ?? ''}
                        onChange={(e) => setMapCoords({ lat: mapCoords?.lat ?? 0, lng: Number(e.target.value) })}
                        placeholder="경도 (lng)"
                        className="rounded border p-2 text-sm"
                      />
                    </div>
                    <div ref={mapRef} className="h-64 w-full rounded border bg-gray-100" />
                    <p className="text-xs text-gray-400">지도를 클릭하면 좌표가 자동 입력됩니다</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(r.id, true)}
                        className="rounded bg-success px-3 py-1.5 text-sm text-white"
                      >
                        보정 완료
                      </button>
                      <button
                        onClick={() => saveEdit(r.id)}
                        className="rounded bg-primary px-3 py-1.5 text-sm text-white"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded bg-gray-200 px-3 py-1.5 text-sm"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{r.name}</h3>
                      <p className="text-sm text-gray-400">
                        {r.address || '주소 없음'} · {r.category} · {r.region || '지역 없음'}
                      </p>
                      <p className="text-xs text-gray-400">
                        lat: {r.lat ?? 'null'}, lng: {r.lng ?? 'null'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(r)}
                        className="rounded bg-primary px-3 py-1.5 text-sm text-white"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deleteRestaurant(r.id)}
                        className="rounded bg-error px-3 py-1.5 text-sm text-white"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* All Restaurants Tab */}
        {tab === 'restaurants' && !loading && (
          <div>
            <div className="space-y-2">
              {allRestaurants.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r) => (
                <div key={r.id} className={`flex items-center justify-between rounded-lg bg-white p-3 shadow-sm ${r.is_visible === false ? 'opacity-50' : ''}`}>
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 text-sm text-gray-400">
                      {r.address || '-'} · {r.category} · {r.region || '-'}
                    </span>
                    {r.needs_review && (
                      <span className="ml-2 rounded bg-warning px-1.5 text-xs">보정필요</span>
                    )}
                    {r.is_visible === false && (
                      <span className="ml-2 rounded bg-gray-300 px-1.5 text-xs text-gray-600">숨김</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const res = await fetch('/api/admin/restaurants', {
                          method: 'PATCH',
                          headers: getHeaders(),
                          body: JSON.stringify({ id: r.id, is_visible: !r.is_visible }),
                        })
                        if (res.ok) {
                          setAllRestaurants(prev => prev.map(item =>
                            item.id === r.id ? { ...item, is_visible: !item.is_visible } : item
                          ))
                        }
                      }}
                      className="text-sm hover:underline"
                      title={r.is_visible ? '숨기기' : '표시하기'}
                    >
                      {r.is_visible !== false ? '👁' : '🚫'}
                    </button>
                    <button
                      onClick={() => deleteRestaurant(r.id)}
                      className="text-sm text-error hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {allRestaurants.length > PAGE_SIZE && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="rounded bg-white px-3 py-1 text-sm disabled:opacity-30"
                >
                  이전
                </button>
                <span className="px-2 py-1 text-sm text-gray-400">
                  {page + 1} / {Math.ceil(allRestaurants.length / PAGE_SIZE)}
                </span>
                <button
                  disabled={(page + 1) * PAGE_SIZE >= allRestaurants.length}
                  onClick={() => setPage(page + 1)}
                  className="rounded bg-white px-3 py-1 text-sm disabled:opacity-30"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}

        {/* Videos Tab */}
        {tab === 'videos' && !loading && (
          <div>
            <div className="space-y-2">
              {videos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((v) => (
                <div key={v.id} className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <a
                        href={`https://youtube.com/watch?v=${v.video_id}${v.timestamp_seconds ? `&t=${v.timestamp_seconds}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {v.title || v.video_id}
                      </a>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
                        <span>평가: {v.rating || '-'}</span>
                        <span>요약: {v.summary || '-'}</span>
                        <span>타임: {v.timestamp_seconds ?? '-'}s</span>
                        <span className={v.is_ad ? 'text-error' : ''}>
                          {v.is_ad ? '광고' : '일반'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const rating = prompt('평가 (강력추천/추천/보통/비추/언급없음)', v.rating || '')
                          if (rating !== null) saveVideo(v.id, { rating })
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => deleteVideo(v.id)}
                        className="text-xs text-error hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {videos.length > PAGE_SIZE && (
              <div className="mt-4 flex justify-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="rounded bg-white px-3 py-1 text-sm disabled:opacity-30"
                >
                  이전
                </button>
                <span className="px-2 py-1 text-sm text-gray-400">
                  {page + 1} / {Math.ceil(videos.length / PAGE_SIZE)}
                </span>
                <button
                  disabled={(page + 1) * PAGE_SIZE >= videos.length}
                  onClick={() => setPage(page + 1)}
                  className="rounded bg-white px-3 py-1 text-sm disabled:opacity-30"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
