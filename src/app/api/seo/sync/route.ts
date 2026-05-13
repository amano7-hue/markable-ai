import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { syncGscData } from '@/modules/seo'
import { prisma } from '@/lib/db/client'

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json().catch(() => ({}))
  const projectId: string | undefined = typeof body.projectId === 'string' ? body.projectId : undefined

  // projectId が指定されていない場合はデフォルトプロジェクトを使用
  const resolvedProjectId = projectId ?? (await prisma.project.findFirst({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  }))?.id

  if (!resolvedProjectId) return err('プロジェクトが見つかりません', 404)

  try {
    const count = await syncGscData(ctx.tenant.id, resolvedProjectId, 30)
    return ok({ synced: count }, 202)
  } catch (e) {
    console.error('[seo/sync] syncGscData failed:', e)
    return err('GSC 同期に失敗しました', 500)
  }
}
