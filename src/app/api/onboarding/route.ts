import { auth } from '@clerk/nextjs/server'
import { ok, err } from '@/lib/api-response'
import { createTenantWithOwner } from '@/lib/tenant'
import { prisma } from '@/lib/db/client'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return err('Unauthorized', 401)

  const body = await req.json()
  const { name, email, userName } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return err('会社名を入力してください')
  }

  // 事前登録チェック
  if (!email) return err('メールアドレスが取得できませんでした', 400)
  const pending = await prisma.pendingTenant.findUnique({ where: { email: email as string } })
  if (!pending) {
    return err('このメールアドレスは管理者による事前登録が必要です', 403)
  }
  if (pending.usedAt) {
    return err('このメールアドレスはすでに使用済みです', 403)
  }

  try {
    await createTenantWithOwner({
      name: name.trim(),
      clerkId: userId,
      email: email as string,
      userName: userName ?? undefined,
    })
    // 使用済みとしてマーク
    await prisma.pendingTenant.update({
      where: { email: email as string },
      data: { usedAt: new Date() },
    })
    return ok({ ok: true })
  } catch (e) {
    console.error('[onboarding] createTenantWithOwner failed:', e)
    return err('ワークスペースの作成に失敗しました', 500)
  }
}
