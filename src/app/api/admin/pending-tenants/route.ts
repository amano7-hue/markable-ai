import { ok, err } from '@/lib/api-response'
import { getAuth } from '@/lib/auth/get-auth'
import { prisma } from '@/lib/db/client'
import { z } from 'zod'

// GET: 一覧取得
export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role !== 'OWNER') return err('権限がありません', 403)

  const list = await prisma.pendingTenant.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return ok(list)
}

const CreateSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  companyName: z.string().min(1, '会社名を入力してください'),
})

// POST: 追加
export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role !== 'OWNER') return err('権限がありません', 403)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? '入力が不正です', 400)
  }

  const { email, companyName } = parsed.data

  try {
    const record = await prisma.pendingTenant.create({
      data: { email, companyName },
    })
    return ok(record)
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return err('このメールアドレスはすでに登録されています', 409)
    }
    console.error('[pending-tenants] create failed:', e)
    return err('登録に失敗しました', 500)
  }
}

// DELETE: 削除
export async function DELETE(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)
  if (ctx.user.role !== 'OWNER') return err('権限がありません', 403)

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return err('id が必要です', 400)

  try {
    await prisma.pendingTenant.delete({ where: { id } })
    return ok({ ok: true })
  } catch {
    return err('削除に失敗しました', 500)
  }
}
