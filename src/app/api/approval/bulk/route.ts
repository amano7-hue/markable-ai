import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import type { ApprovalStatus } from '@/generated/prisma'

const BulkSchema = z.object({
  action: z.enum(['approve', 'reject']),
  module: z.string().optional(),
  ids: z.array(z.string()).optional(),
})

/**
 * POST /api/approval/bulk
 * ids指定 → そのアイテムだけ処理
 * ids未指定 → module フィルタに一致するすべての PENDING アイテムを処理
 * 対応するドメインモデル（NurtureEmailDraft, SeoArticle）も同時更新。
 */
export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const { action, module, ids } = parsed.data
  const status: ApprovalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()

  const where = {
    tenantId: ctx.tenant.id,
    status: 'PENDING' as const,
    ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    ...(module ? { module } : {}),
  }

  // Fetch affected items to sync domain models
  const affectedItems = await prisma.approvalItem.findMany({
    where,
    select: { type: true, payload: true },
  })

  const draftIds = affectedItems
    .filter((i) => i.type === 'nurturing_email_draft')
    .map((i) => (i.payload as Record<string, unknown>).draftId)
    .filter((id): id is string => typeof id === 'string')

  const articleIds = affectedItems
    .filter((i) => i.type === 'seo_article_draft')
    .map((i) => (i.payload as Record<string, unknown>).articleId)
    .filter((id): id is string => typeof id === 'string')

  const data = { status, reviewedAt, reviewedBy: ctx.user.id }

  const result = await prisma.approvalItem.updateMany({ where, data })

  if (draftIds.length > 0) {
    await prisma.nurtureEmailDraft.updateMany({
      where: { tenantId: ctx.tenant.id, id: { in: draftIds } },
      data,
    })
  }

  if (articleIds.length > 0) {
    await prisma.seoArticle.updateMany({
      where: { tenantId: ctx.tenant.id, id: { in: articleIds } },
      data,
    })
  }

  return ok({ updated: result.count })
}
