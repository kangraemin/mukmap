// 유튜버가 그 가게에서 한 말을 예능 자막처럼 보여준다. 이 사이트에서 가장 눈에 띄는 요소는 이것 하나다.
interface CaptionQuoteProps {
  text: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = { sm: 'text-[14px]', md: 'text-[17px]', lg: 'text-[22px]' }

export default function CaptionQuote({ text, size = 'md', className = '' }: CaptionQuoteProps) {
  return (
    <p className={`${SIZE[size]} ${className}`}>
      <span className="caption-band">{text}</span>
    </p>
  )
}
