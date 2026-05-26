import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'

type Params = { params: Promise<{ articleId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { articleId } = await params

  const article = await prisma.seoArticle.findFirst({
    where: { id: articleId, tenantId: ctx.tenant.id },
    select: { sourceContent: true, rewriteReasons: true, draft: true },
  })
  if (!article) return err('Not found', 404)
  if (!article.sourceContent) return err('差分データがありません', 404)

  return ok({
    sourceContent: article.sourceContent,
    rewriteReasons: article.rewriteReasons ? JSON.parse(article.rewriteReasons) as string[] : [],
    draft: article.draft ?? '',
  })
}
