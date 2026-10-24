import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { DATA_TAG } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret')
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  revalidateTag(DATA_TAG)
  revalidatePath('/', 'layout')
  revalidatePath('/api/channels')
  revalidatePath('/api/restaurants')
  revalidatePath('/api/pins')
  revalidatePath('/api/pins/[lang]', 'page')

  return NextResponse.json({ revalidated: true, ts: Date.now() })
}
