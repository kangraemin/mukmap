'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { Channel } from '@/lib/types'
import { getChannelHue, channelColor, channelTint, channelDeep } from '@/lib/constants'

interface OnboardingProps {
  channels: Channel[]
  onComplete: (selectedIds: string[]) => void
  restaurantCount?: number
}

function PinIcon() {
  return (
    <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
      <path
        d="M16 28s10-9.2 10-16.8A10 10 0 0 0 6 11.2C6 18.8 16 28 16 28z"
        fill="white"
      />
      <circle cx="16" cy="12" r="3.2" fill="rgba(255,255,255,0.6)" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none">
      <path
        d="M3 8l3 3 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: i === step ? 18 : 5,
            height: 5,
            borderRadius: 999,
            background: i === step ? '#D9614A' : '#D5CDB8',
            transition: 'width 0.2s ease',
          }}
        />
      ))}
    </div>
  )
}

export default function Onboarding({ channels, onComplete, restaurantCount = 0 }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [picks, setPicks] = useState<string[]>([])

  const handleChannelToggle = (id: string) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const handleNext = () => {
    if (step === 0) {
      setStep(1)
    } else if (step === 1) {
      setStep(2)
    } else {
      onComplete(picks)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white px-6 pb-6 pt-5 shadow-2xl">
        {/* Progress dots */}
        <div className="mb-5">
          <ProgressDots step={step} />
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-2xl"
              style={{ background: '#D9614A' }}
            >
              <PinIcon />
            </div>
            <h1 className="mb-2 text-[26px] font-extrabold tracking-tight text-[#221E15]">
              MukMap
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-[#6B6352]">
              유튜버가 다녀간 진짜 맛집,
              <br />
              지도 위에서 한눈에.
            </p>
            <button
              onClick={handleNext}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white"
              style={{ background: '#D9614A' }}
            >
              시작하기
            </button>
          </div>
        )}

        {/* Step 1: 채널 선택 */}
        {step === 1 && (
          <div className="flex flex-col">
            <h2 className="mb-1 text-[18px] font-extrabold tracking-tight text-[#221E15]">
              좋아하는 유튜버를 선택하세요
            </h2>
            <p className="mb-4 text-[12.5px] text-[#6B6352]">최대 5명까지 선택 가능합니다</p>

            <div className="mb-4 flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
              {channels.map((ch, idx) => {
                const hue = getChannelHue(ch.id, idx)
                const isSelected = picks.includes(ch.id)
                const isDisabled = !isSelected && picks.length >= 5
                return (
                  <button
                    key={ch.id}
                    onClick={() => !isDisabled && handleChannelToggle(ch.id)}
                    disabled={isDisabled}
                    style={{
                      background: isSelected ? channelTint(hue) : 'transparent',
                      borderColor: isSelected ? channelColor(hue) : '#E5DFD0',
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors duration-100"
                  >
                    {/* Avatar */}
                    <div
                      style={{ background: channelColor(hue) }}
                      className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
                    >
                      {ch.thumbnail_url ? (
                        <Image
                          src={ch.thumbnail_url}
                          alt={ch.name}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{ch.name[0]}</span>
                      )}
                    </div>

                    {/* 이름 */}
                    <div className="flex-1 overflow-hidden">
                      <p
                        style={{ color: isSelected ? channelDeep(hue) : '#221E15' }}
                        className="truncate text-[13px] font-semibold leading-tight"
                      >
                        {ch.name}
                      </p>
                    </div>

                    {/* 체크박스 */}
                    <div
                      style={{
                        background: isSelected ? channelColor(hue) : 'transparent',
                        borderColor: isSelected ? channelColor(hue) : '#D5CDB8',
                      }}
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px] text-white"
                    >
                      {isSelected && <CheckIcon />}
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleNext}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white"
              style={{ background: '#D9614A' }}
            >
              {picks.length === 0 ? '건너뛰기' : `${picks.length}명 선택 완료`}
            </button>
          </div>
        )}

        {/* Step 2: 준비완료 */}
        {step === 2 && (
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-full"
              style={{ background: '#FFEFD8' }}
            >
              <span style={{ fontSize: 40 }}>🔥</span>
            </div>
            <h2 className="mb-2 text-[22px] font-extrabold tracking-tight text-[#221E15]">
              준비 완료!
            </h2>
            <p className="mb-7 text-[14px] leading-relaxed text-[#6B6352]">
              {restaurantCount > 0
                ? `${restaurantCount}개의 맛집이 지도에 핀으로 떠 있어요.`
                : '맛집들이 지도에 핀으로 떠 있어요.'}
            </p>
            <button
              onClick={handleNext}
              className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white"
              style={{ background: '#D9614A' }}
            >
              지도 보러 가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
