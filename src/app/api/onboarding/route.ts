import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createTenantWithOwner } from '@/lib/tenant'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, email, userName } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })
  }

  try {
    await createTenantWithOwner({
      name: name.trim(),
      clerkId: userId,
      email: email ?? '',
      userName: userName ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[onboarding] createTenantWithOwner failed:', err)
    return NextResponse.json({ error: 'ワークスペースの作成に失敗しました' }, { status: 500 })
  }
}
