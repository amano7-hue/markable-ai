import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { getPrompt, updatePrompt, deletePrompt, UpdatePromptSchema } from '@/modules/aeo'

type Params = { params: Promise<{ promptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const prompt = await getPrompt(ctx.tenant.id, promptId)
  if (!prompt) return err('Not found', 404)
  return ok(prompt)
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  const body = await req.json()
  const parsed = UpdatePromptSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const prompt = await updatePrompt(ctx.tenant.id, promptId, parsed.data)
  return ok(prompt)
}

export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const { promptId } = await params
  await deletePrompt(ctx.tenant.id, promptId)
  return ok({ deleted: true })
}
