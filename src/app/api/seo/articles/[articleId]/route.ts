import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getArticle } from '@/modules/seo'
import { prisma } from '@/lib/db/client'

type Params = { params: Promise<{ articleId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { articleId } = await params
  const article = await getArticle(ctx.tenant.id, articleId)
  if (!article) return err('Not found', 404)
  return ok(article)
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { articleId } = await params
  const body = (await req.json()) as { action: 'approve' | 'reject' }

  if (!['approve', 'reject'].includes(body.action)) {
    return err('Invalid action')
  }

  const status = body.action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()

  await prisma.seoArticle.updateMany({
    where: { id: articleId, tenantId: ctx.tenant.id },
    data: { status, reviewedAt, reviewedBy: ctx.user.id },
  })

  // Keep ApprovalItem in sync
  await prisma.approvalItem.updateMany({
    where: {
      tenantId: ctx.tenant.id,
      type: 'seo_article_draft',
      status: 'PENDING',
      payload: { path: ['articleId'], equals: articleId },
    },
    data: { status, reviewedAt, reviewedBy: ctx.user.id },
  })

  return ok({ updated: true })
}
