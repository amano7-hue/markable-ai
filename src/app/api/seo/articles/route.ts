import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listArticles } from '@/modules/seo'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? undefined

  const articles = await listArticles(ctx.tenant.id, status)
  return ok(articles)
}
