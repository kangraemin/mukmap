'use client'

import { useState } from 'react'
import { ShareIcon } from './ShareIcon'
import Toast from './Toast'
import { webShare } from '@/lib/webShare'

/** 서버가 그린 가게 페이지의 공유 버튼. 휴대폰 공유창, 없으면 링크 복사 */
export default function PageShareButton({ query, text, label = '공유' }: { query: string; text: string; label?: string }) {
  const [toast, setToast] = useState('')
  return (
    <>
      <button
        type="button"
        aria-label={label}
        data-testid="share-detail"
        onClick={() => webShare({ query, text }).then((r) => { if (typeof r === 'string') setToast(r) })}
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-card border border-line text-ink"
      >
        <ShareIcon />
      </button>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  )
}
