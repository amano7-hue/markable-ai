import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import type { ApprovalStatus } from '@/generated/prisma'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const moduleFilter = url.searchParams.get('module') ?? undefined
  const status = (url.searchParams.get('status') ?? undefined) as ApprovalStatus | undefined

  const items = await prisma.approvalItem.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(items)
}

const PatchSchema = z.object({
  id: z.string(),
  action: z.enum(['approve', 'reject']),
  /** 編集済みペイロードフィールド（インライン編集時のみ） */
  edits: z.record(z.string()).optional(),
})

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const { id, edits } = parsed.data
  const status: ApprovalStatus =
    parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()

  // Fetch the item first to know its type and payload
  const item = await prisma.approvalItem.findFirst({
    where: { id, tenantId: ctx.tenant.id },
  })
  if (!item) return err('Not found', 404)

  const payload = { ...(item.payload as Record<string, unknown>), ...edits }

  // Update the ApprovalItem (merge edited fields into payload if any)
  await prisma.approvalItem.updateMany({
    where: { id, tenantId: ctx.tenant.id },
    data: { status, reviewedAt, reviewedBy: ctx.user.id, payload },
  })

  // Also update the domain model so both stay in sync
  if (item.type === 'nurturing_email_draft' && typeof payload.draftId === 'string') {
    await prisma.nurtureEmailDraft.updateMany({
      where: { id: payload.draftId, tenantId: ctx.tenant.id },
      data: {
        status,
        reviewedAt,
        reviewedBy: ctx.user.id,
        ...(edits?.subject ? { subject: edits.subject } : {}),
        ...(edits?.body ? { body: edits.body } : {}),
      },
    })
  } else if (item.type === 'seo_article_draft' && typeof payload.articleId === 'string') {
    await prisma.seoArticle.updateMany({
      where: { id: payload.articleId, tenantId: ctx.tenant.id },
      data: {
        status,
        reviewedAt,
        reviewedBy: ctx.user.id,
        ...(edits?.title ? { title: edits.title } : {}),
        ...(edits?.brief ? { brief: edits.brief } : {}),
        ...(edits?.draft ? { draft: edits.draft } : {}),
      },
    })
  }

  return ok({ updated: true })
}
