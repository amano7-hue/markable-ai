import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

type Params = { params: Promise<{ draftId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { draftId } = await params
  const body = (await req.json()) as { action: 'approve' | 'reject' }

  if (!['approve', 'reject'].includes(body.action)) return err('Invalid action')

  const status = body.action === 'approve' ? 'APPROVED' : 'REJECTED'
  await prisma.nurtureEmailDraft.updateMany({
    where: { id: draftId, tenantId: ctx.tenant.id },
    data: { status, reviewedAt: new Date(), reviewedBy: ctx.user.id },
  })

  return ok({ updated: true })
}
