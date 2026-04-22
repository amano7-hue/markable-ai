import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getKeyword, updateKeyword, deleteKeyword, UpdateKeywordSchema } from '@/modules/seo'

type Params = { params: Promise<{ keywordId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { keywordId } = await params
  const keyword = await getKeyword(ctx.tenant.id, keywordId)
  if (!keyword) return err('Not found', 404)
  return ok(keyword)
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { keywordId } = await params
  const body = await req.json()
  const parsed = UpdateKeywordSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const keyword = await updateKeyword(ctx.tenant.id, keywordId, parsed.data)
  return ok(keyword)
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { keywordId } = await params
  await deleteKeyword(ctx.tenant.id, keywordId)
  return ok({ deleted: true })
}
