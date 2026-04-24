import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listKeywords, createKeyword, CreateKeywordSchema } from '@/modules/seo'
import type { KeywordSortKey } from '@/modules/seo'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const sort = (url.searchParams.get('sort') ?? 'created') as KeywordSortKey
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const intent = url.searchParams.get('intent') ?? undefined

  const result = await listKeywords(ctx.tenant.id, { sort, page, intent })
  return ok(result)
}

export async function POST(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = CreateKeywordSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const keyword = await createKeyword(ctx.tenant.id, parsed.data)
  return ok(keyword, 201)
}
