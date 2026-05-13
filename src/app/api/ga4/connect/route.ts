import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

const PatchSchema = z.object({
  propertyId: z.string().min(1),
  projectId: z.string().optional(),
})

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const conn = await prisma.ga4Connection.findFirst({
    where: { tenantId: ctx.tenant.id },
    select: { email: true, propertyId: true, updatedAt: true },
  })

  return ok({ connected: !!conn, connection: conn })
}

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('リクエスト形式が不正です', 400)
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message, 400)

  const { propertyId, projectId } = parsed.data
  const tenantId = ctx.tenant.id

  try {
    // projectId 指定あり → そのプロジェクトの接続を探す
    // 見つからなければ projectId なし（テナント共通）の接続にフォールバック
    let conn = projectId
      ? await prisma.ga4Connection.findFirst({ where: { tenantId, projectId } })
      : await prisma.ga4Connection.findFirst({ where: { tenantId } })

    // projectId 指定あり & 見つからない場合 → projectId なし接続を移行
    if (!conn && projectId) {
      conn = await prisma.ga4Connection.findFirst({ where: { tenantId, projectId: null } })
      if (conn) {
        await prisma.ga4Connection.updateMany({
          where: { id: conn.id, tenantId },
          data: { projectId, propertyId },
        })
        return ok({ updated: true })
      }
    }

    if (!conn) {
      return err('GA4 が接続されていません。先に Google アカウントを連携してください。', 400)
    }

    await prisma.ga4Connection.updateMany({
      where: { id: conn.id, tenantId },
      data: { propertyId },
    })

    return ok({ updated: true })
  } catch (e) {
    console.error('[ga4/connect PATCH] error:', e)
    return err('DB 更新に失敗しました', 500)
  }
}
