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
 * idsを指定 → そのアイテムだけ処理
 * ids未指定 → module フィルタに一致するすべての PENDING アイテムを処理
 */
export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const { action, module, ids } = parsed.data
  const status: ApprovalStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

  const result = await prisma.approvalItem.updateMany({
    where: {
      tenantId: ctx.tenant.id,
      status: 'PENDING',
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      ...(module ? { module } : {}),
    },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedBy: ctx.user.id,
    },
  })

  return ok({ updated: result.count })
}
