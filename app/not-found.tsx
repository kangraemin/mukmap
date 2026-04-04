import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 text-6xl">🍽️</div>
        <h1 className="mb-2 text-2xl font-bold text-secondary">이 페이지를 찾을 수 없어요</h1>
        <p className="mb-6 text-sm text-gray-400">요청하신 페이지가 존재하지 않습니다</p>
        <Link
          href="/"
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
        >
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
