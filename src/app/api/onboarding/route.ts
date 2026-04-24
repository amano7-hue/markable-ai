import { auth } from '@clerk/nextjs/server'
import { ok, err } from '@/lib/api-response'
import { createTenantWithOwner } from '@/lib/tenant'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return err('Unauthorized', 401)

  const body = await req.json()
  const { name, email, userName } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return err('会社名を入力してください')
  }

  try {
    await createTenantWithOwner({
      name: name.trim(),
      clerkId: userId,
      email: email ?? '',
      userName: userName ?? undefined,
    })
    return ok({ ok: true })
  } catch (e) {
    console.error('[onboarding] createTenantWithOwner failed:', e)
    return err('ワークスペースの作成に失敗しました', 500)
  }
}
