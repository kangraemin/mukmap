'use client'

import { useEffect } from 'react'
import { listenTrackedClicks } from '@/lib/analytics'

/** 서버에서 그린 페이지의 data-track 버튼(토스 앱으로 열기·영상 보기)을 GA4로 보낸다 */
export default function TrackClicks() {
  useEffect(() => listenTrackedClicks(), [])
  return null
}
