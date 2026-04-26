import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

type Params = { params: Promise<{ draftId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { draftId } = await params
  const body = (await req.json()) as {
    action: 'approve' | 'reject'
    subject?: string
    emailBody?: string
  }

  if (!['approve', 'reject'].includes(body.action)) return err('Invalid action')

  const status = body.action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()

  await prisma.nurtureEmailDraft.updateMany({
    where: { id: draftId, tenantId: ctx.tenant.id },
    data: {
      status,
      reviewedAt,
      reviewedBy: ctx.user.id,
      ...(body.subject ? { subject: body.subject } : {}),
      ...(body.emailBody ? { body: body.emailBody } : {}),
    },
  })

  // Keep ApprovalItem in sync
  await prisma.approvalItem.updateMany({
    where: {
      tenantId: ctx.tenant.id,
      type: 'nurturing_email_draft',
      status: 'PENDING',
      payload: { path: ['draftId'], equals: draftId },
    },
    data: { status, reviewedAt, reviewedBy: ctx.user.id },
  })

  return ok({ updated: true })
}
