import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { listKeywords, createKeyword, CreateKeywordSchema } from '@/modules/seo'

export async function GET() {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const keywords = await listKeywords(ctx.tenant.id)
  return ok(keywords)
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
