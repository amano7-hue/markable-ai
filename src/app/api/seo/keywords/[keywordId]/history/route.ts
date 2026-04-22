import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getKeywordHistory } from '@/modules/seo'

type Params = { params: Promise<{ keywordId: string }> }

export async function GET(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { keywordId } = await params
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') ?? '30')

  const history = await getKeywordHistory(ctx.tenant.id, keywordId, days)
  return ok(history)
}
