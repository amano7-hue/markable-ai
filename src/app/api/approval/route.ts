import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import type { ApprovalStatus } from '@/generated/prisma'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const module = url.searchParams.get('module') ?? undefined
  const status = (url.searchParams.get('status') ?? undefined) as ApprovalStatus | undefined

  const items = await prisma.approvalItem.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(module ? { module } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(items)
}

const PatchSchema = z.object({
  id: z.string(),
  action: z.enum(['approve', 'reject']),
})

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const { id } = parsed.data

  const status: ApprovalStatus =
    parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED'

  const item = await prisma.approvalItem.updateMany({
    where: { id, tenantId: ctx.tenant.id },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedBy: ctx.user.id,
    },
  })

  if (item.count === 0) return err('Not found', 404)
  return ok({ updated: true })
}
