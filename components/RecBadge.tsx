const BADGE: Record<string, string> = {
  강추: 'bg-[#FFEBEE] text-[#D22030]',
  추천: 'bg-[#E8F3FF] text-[#1B64DA]',
  보통: 'bg-[#F2F4F6] text-[#4E5968]',
  아쉬움: 'bg-[#FFF4E6] text-[#B25E00]',
}

/** 유튜버의 추천 정도(강추/추천/보통/아쉬움) */
export function RecBadge({ rec, label }: { rec?: string | null; label?: string }) {
  if (!rec || !BADGE[rec]) return null
  return <span className={`flex-shrink-0 rounded-[6px] px-1.5 py-0.5 text-[12px] font-bold leading-4 ${BADGE[rec]}`}>{label || rec}</span>
}
